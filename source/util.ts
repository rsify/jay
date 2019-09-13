import {createWriteStream} from 'fs'

import * as t from 'io-ts'
import builtinModules from 'builtin-modules'
import readPkgUp from 'read-pkg-up'
import {isLeft, Either} from 'fp-ts/lib/Either'

const {env} = process

export interface LooseObject {
	[key: string]: any
}

const debugFifo = env.JAY_FIFO === undefined && env.JAY_DEBUG === undefined ?
	null :
	createWriteStream(env.JAY_FIFO || 'jay-debug')

export const debug = (msg: string, ...rest: string[]): any =>
	debugFifo &&
		msg.startsWith(env.JAY_DEBUG || '') &&
		debugFifo.write([msg].concat(rest).join(' ') + '\n')

export const time = (title: string): (() => string) => {
	const start = process.hrtime()

	return () => {
		const diff = process.hrtime(start)
		const ms = ((diff[0] * 1e9) + diff[1]) / 1e6
		return `time ${title}: ${ms}ms`
	}
}

export function returnError<T>(fn: () => T): T | Error {
	try {
		return fn()
	} catch (error) {
		return error
	}
}

export const addBuiltinsToObject = (o: LooseObject): void =>
	builtinModules.forEach(m =>
		Object.defineProperty(o, m, {
			configurable: true,
			// Keeping it non-enumerable so as to not pollute the output from
			// running `global` in the repl, which would in turn actually
			// trigger the getter, rendering this whole mechanism useless.
			enumerable: false,
			get() {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const required = require(m)

				delete o[m]
				Object.defineProperty(o, m, {
					configurable: true,
					enumerable: false,
					writable: true,
					value: required
				})

				return required
			}
		})
	)

export const addGlobalsToObject = (o: LooseObject): void =>
	Object.getOwnPropertyNames(global).forEach(name => {
		if (name === 'global') {
			return
		}

		const descriptor =
			Object.getOwnPropertyDescriptor(global, name)

		if (typeof descriptor !== 'undefined') {
			Object.defineProperty(
				o,
				name,
				descriptor
			)
		}
	})

export function getOrThrow<E, A>(
	either: Either<E, A>,
	messageFn: (err: E) => string
): A {
	if (isLeft(either)) {
		throw new Error(messageFn(either.left))
	}

	return either.right
}

// Reading package.json like this prevents typescript from nesting the "source"
// folder within dist - doing `import '../package.json'` from `source` creates
// `dist/package.json` and `dist/source/*`. This normally wouldn't be a big
// problem, apart from the fact that npm reads nested package.json files when
// publishing, completely messing up the "files" property that gets read not
// only from `/` but also `/source`. Since we have `dist` in the `files`
// package.json property, npm looks for `source/dist`, and only for that folder
// (which obviously doesn't exist within `source`).
const PackageJson = t.intersection([
	t.type({
		name: t.string,
		version: t.string,
		description: t.string,
		homepage: t.string,
		author: t.type({
			name: t.string,
			email: t.string,
			url: t.string
		})
	}),
	t.record(t.string, t.unknown)
])

export const packageJson = getOrThrow(
	PackageJson.decode((readPkgUp.sync({
		cwd: __dirname
	}) || {package: {}}).package),
	() => 'Could not find/parse jay\'s `package.json` file'
)
