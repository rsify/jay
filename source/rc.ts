import fs from 'fs'
import path from 'path'
import {Console} from 'console' // eslint-disable-line node/prefer-global/console

import chalk from 'chalk'
import envPaths from 'env-paths'
import figures from 'figures'
import makeDir from 'make-dir'
import pkgDir from 'pkg-dir'

import {Jay} from './types'

import {createAsk} from './ask'
import {createContext} from './inspector'
import {createEvaluator} from './eval'
import {createModuler, findRequired, processRequired} from './moduler'
import {packageJson, returnError, LooseObject} from './util'

export function createRc(rcPath: string) {
	makeDir.sync(path.dirname(rcPath))

	const packageRoot = pkgDir.sync()

	if (packageRoot === undefined) {
		throw new Error(`Could not find ${packageJson.name}'s root directory`)
	}

	if (!fs.existsSync(rcPath)) {
		const defaultRc = fs.readFileSync(
			path.join(packageRoot, 'share/jayrc.js'), 'utf-8'
		)

		fs.writeFileSync(rcPath, defaultRc)
	}

	async function load(
		jay: Jay
	): Promise<void> {
		const moduler = createModuler(
			path.join(envPaths(packageJson.name).cache, 'packages'),
			path.dirname(rcPath),
			['relative', 'global cache']
		)

		const _require = (id: string) => {
			const {name} = packageJson

			if (id === name || id.startsWith(name)) {
				// `jay` gets special treatment so that its id
				// can be resolved to the currently running
				// version's location

				if (!packageRoot) {
					throw new Error(`Could not find ${name}'s root directory`)
				}

				id = id.replace(name, packageRoot)
			}

			return moduler.require(id)
		}

		const rcContents = fs.readFileSync(rcPath, 'utf-8')
		const rawRequired = returnError(() => findRequired(rcContents))

		if (rawRequired instanceof Error) {
			throw rawRequired
		}

		const required: typeof rawRequired = {
			errors: rawRequired.errors,
			packages: rawRequired.packages.filter(pack =>
				pack.name !== packageJson.name
			)
		}

		await processRequired({
			ask: createAsk(moduler, process.stdin, process.stdout),
			moduler,
			required
		})

		const mod: LooseObject = {exports: undefined}
		const {context, contextId} = await createContext({
			module: mod,
			exports: mod.exports,
			require: _require,
			console: new Console(
				jay.stdin,
				jay.stdout
			)
		})
		const ev = createEvaluator(context, contextId)

		ev.evaluate(rcContents)

		const rcFilename = path.basename(rcPath)
		if (typeof mod.exports !== 'function') {
			throw new TypeError(
				`The default export of ${rcFilename} must be of type \`function\` (location: ${rcPath})`
			)
		}

		try {
			await mod.exports(jay)
		} catch (error) {
			console.error(chalk.red(figures.cross, `Uncaught Error while evaluating ${rcFilename}`))
			console.error(chalk.gray(error.stack))

			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(1)
		}
	}

	return {load}
}
