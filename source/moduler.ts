// Handles installing packages, creating a custom require function, etc. used inside the repl

import path from 'path'

import * as acorn from 'acorn'
import * as t from 'io-ts'
import {failure} from 'io-ts/lib/PathReporter'
import * as walk from 'acorn-walk'
import execa from 'execa'
import importFresh from 'import-fresh'
import makeDir from 'make-dir'
import resolve from 'resolve'
import readPkgUp from 'read-pkg-up'

import {debug, time} from './util'

export const findRequiredErrors = {
	parseError: 'Could not parse provided code',
	invalidArguments: 'Arguments of a `require` call must be a ' +
	'single string literal, e.g. require(\'got\')',
	invalidArgumentFormat: '`require` argument must be in one of the forms of: ' + [
		'<name>',
		'<scope>/<name>',
		'<name>@<version>',
		'<scope>/<name>@<version>'
	].join(', ')
}

export interface Resolved {
	location: 'relative' | 'node_modules' | 'global cache'
	filepath: string
	meta?: {
		name: string
		version: string
	}
}

export interface Required {
	name: PackageMeta['name']
	version?: PackageMeta['version']
	path?: string
}

const InstalledIO = t.type({
	elapsed: t.number,
	added: t.array(t.type({
		action: t.string,
		name: t.string,
		version: t.string,
		path: t.string
	}))
})

export type Installed = t.TypeOf<typeof InstalledIO>

export interface FindRequiredOutput {
	errors: string[]
	packages: Required[]
}

export interface PackageMeta {
	name: string
	version: string
	maintainers: string[]
	published: string
	description?: string
	homepage?: string
	license?: string
	dependencies: {
		[name: string]: string
	}
}

type RegistryErrorCodes = 'NOT_FOUND' | 'UNKNOWN'
export class RegistryError extends Error {
	code: string

	constructor(code: RegistryErrorCodes, message: string) {
		super(message)
		this.code = code
		this.message = message
	}
}

const moduleIdRegex =
	/^((?:[^@\s/]+)|(?:@[^@\s/]+\/[^@\s/]+))(?:@([^@\s/]+))?(\/[^@\s]*)?$/

export function stripVersion(id: string): string {
	const res = moduleIdRegex.exec(id)

	if (!res) {
		throw new Error(`Invalid module id: ${id}`)
	}

	const [, name, , _path] = res

	return name + (_path ? _path : '')
}

export function isLocalModuleId(id: string): boolean {
	return id.startsWith('.') || id.startsWith('/')
}

export function findRequired(code: string): FindRequiredOutput {
	const astTime = time('ast')
	const ast = (code => {
		try {
			return acorn.parse(code)
		} catch {
			return null
		}
	})(code)
	debug(astTime())

	if (!ast) {
		return {
			errors: [findRequiredErrors.parseError],
			packages: []
		}
	}

	const walkTime = time('walk')
	const visitors = {
		CallExpression(node: any, state: FindRequiredOutput) {
			if (node.callee.name !== 'require') {
				return
			}

			// Ensure that there exists only and only one
			// argument that is a literal string
			if (
				node.arguments.length !== 1 ||
				node.arguments[0].type !== 'Literal' ||
				typeof node.arguments[0].value !== 'string'
			) {
				state.errors.push(findRequiredErrors.invalidArguments)

				return
			}

			const {value} = node.arguments[0]

			// Ensure proper format, we don't care about testing whether this
			// is a 100% valid npm package because we're just checking whether
			// it exists or not
			const res = moduleIdRegex.exec(value)

			if (!res) {
				state.errors.push(findRequiredErrors.invalidArgumentFormat)
				return
			}

			const [, name, version, _path] = res

			if (
				!resolve.isCore(name) &&
				!isLocalModuleId(name)
			) {
				state.packages.push({
					name,
					...(version !== undefined) && {version},
					...(_path !== undefined) && {path: _path}
				})
			}
		}
	}

	const state: FindRequiredOutput = {
		errors: [],
		packages: []
	}

	walk.simple(ast, visitors, null, state)
	debug(walkTime())

	return state
}

export interface Moduler {
	// Retrieve npm information about a package
	info(name: string, version?: string): Promise<PackageMeta>

	// Install a package from npm
	install(name: string, version?: string): Promise<Installed | undefined>

	// Resolve a package id (like `@nikersify/noop@1.0.0`) to a path
	resolve(id: string): Resolved

	// Require a module, uses `resolve`'s algorithm to find the main file
	require(id: string): unknown
}

export function createModuler(basePath: string): Moduler {
	makeDir.sync(basePath)

	function _resolve(id: string): Resolved {
		// 1. Resolve local relative modules
		if (isLocalModuleId(id)) {
			return {
				location: 'relative',
				// We let this throw normally
				filepath: resolve.sync(id, {
					basedir: process.cwd()
				})
			}
		}

		const strippedId = stripVersion(id)

		const Pkg = t.type({
			package: t.intersection([
				t.type({
					name: t.string,
					version: t.string
				}),
				t.record(t.string, t.unknown)
			]),
			path: t.string
		})

		const decodePkg = (filepath: string) =>
			Pkg.decode(readPkgUp.sync({
				cwd: path.dirname(filepath)
			})).getOrElseL(() => {
				throw new Error(`\`${id}\` has an invalid \`package.json\` file`)
			})

		// 2. Resolve local node_modules
		try {
			const filepath = resolve.sync(strippedId, {
				basedir: process.cwd()
			})

			const pkg = decodePkg(filepath).package

			return {
				location: 'node_modules',
				filepath,
				meta: {
					name: pkg.name,
					version: pkg.version
				}
			}
		} catch {}

		// 3. Resolve in global cache
		const filepath = resolve.sync(strippedId, {
			basedir: path.join(path.join(basePath, 'lib'))
		})

		const pkg = decodePkg(filepath).package

		return {
			location: 'global cache',
			filepath,
			meta: {
				name: pkg.name,
				version: pkg.version
			}
		}
	}

	function _require(id: string): unknown {
		return importFresh(_resolve(id).filepath)
	}

	async function install(name: string, version: string = 'latest'): Promise<Installed | undefined> {
		const id = name + (version ? '@' + version : '')
		const args = [
			'install',
			id,
			'--prefix',
			basePath,
			'--global',
			'--loglevel',
			'error',
			'--color',
			'always',
			'--json'
		]

		const {stdout} = await execa('npm', args, {
			stderr: 'inherit'
		})

		try {
			return t.intersection([
				InstalledIO,
				t.record(t.string, t.unknown)
			]).decode(JSON.parse(stdout)).getOrElseL(errors => {
				throw new Error(failure(errors).join('\n'))
			})
		} catch {}

		return undefined
	}

	async function info(
		name: string,
		version: string = 'latest'
	): Promise<PackageMeta> {
		const id = name + (version ? '@' + version : '')
		const args = [
			'info',
			id,
			'--json'
		]

		const {code, stdout} = await execa('npm', args, {
			reject: false,
			stderr: 'pipe'
		})

		const optional = <T>(x: t.Type<T>) => t.union([x, t.undefined])
		const OutputSuccess = t.intersection([
			t.type({
				name: t.string,
				version: t.string,
				time: t.record(t.string, t.string),
				maintainers: t.array(t.string),
				description: optional(t.string),
				homepage: optional(t.string),
				dependencies: optional(t.record(t.string, t.string)),
				license: optional(t.string)
			}),
			t.record(t.string, t.unknown)
		])

		const OutputError = t.type({
			error: t.type({
				code: t.string,
				summary: t.string,
				detail: t.string
			})
		})

		const parsed = JSON.parse(stdout)

		if (code !== 0) {
			const {error} = OutputError.decode(parsed)
				.getOrElseL(errors => {
					throw new Error(failure(errors).join('\n'))
				})

			if (error.code === 'E404') {
				throw new RegistryError(
					'NOT_FOUND',
					`\`${id}\` was not found on the npm registry.`
				)
			}

			throw new RegistryError('UNKNOWN', error.summary)
		}

		const output = OutputSuccess.decode(parsed)
			.getOrElseL(errors => {
				console.log(parsed)
				throw new Error(failure(errors).join('\n'))
			})

		const published = output.time[output.version]

		return {
			name: output.name,
			version: output.version,
			maintainers: output.maintainers,
			published,
			description: output.description,
			homepage: output.homepage,
			license: output.license,
			dependencies: output.dependencies || {}
		}
	}

	return {
		require: _require,
		resolve: _resolve,
		install,
		info
	}
}
