import path from 'path'

import envPaths from 'env-paths'
import figures from 'figures'
import {default as c} from 'chalk'
import {uniq} from 'lodash'

import {Jay} from '../types'

import {
	FindRequiredOutput,
	Moduler,
	RegistryError,
	createModuler,
	findRequired
} from '../moduler'

import {Ask, createAsk} from '../ask'
import {
	packageJson,
	returnError
} from '../util'

async function processRequired({
	required,
	moduler,
	ask
}: {
	required: FindRequiredOutput
	moduler: Moduler
	ask: Ask
}) {
	for (const pack of required.packages) {
		/* eslint-disable no-await-in-loop */
		const resolved = returnError(() =>
			moduler.resolve(pack.name)
		)

		if (resolved instanceof Error) {
			// The module id is not a relative path and
			// couldn't be resolved, ask the user whether
			// they want to install it

			let answer: boolean
			try {
				answer = await ask.install(
					pack.name,
					pack.version
				)
			} catch (error) {
				if (
					error instanceof RegistryError &&
					error.code === 'NOT_FOUND'
				) {
					console.error(c.red(
						figures.cross,
						'Package',
						c.bold(pack.name) + (pack.version ?
							c.bold(`@${pack.version}`) : ''),
						'was not found on the registry.'
					))

					continue
				}

				console.error(error)
				continue
			}

			if (answer) {
				const installed = await moduler.install(
					pack.name,
					pack.version
				)

				console.log(c.blue(
					figures.arrowDown,
					c.bold(pack.name + (pack.version ?
						c.gray.bold('@' + pack.version) : '')
					),
					'installed',
					installed ?
						`in ${Math.round(installed.elapsed * 10000) / 10000000}s!` :
						'!'
				) + '\n')
			}
		} else {
			const loc =	resolved.location === 'global cache' ?
				'jay\'s cache' :
				resolved.location

			console.log(
				c.green(
					figures.tick,
					resolved.meta ?
						`${
							c.bold(resolved.meta.name)
						}${
							c.gray.bold('@' + resolved.meta.version)
						}` :
						`${c.bold(pack.name)}`
					,
					`imported from ${c.italic(loc)}.`
				)
			)
		}
		/* eslint-enable no-await-in-loop */
	}
}

export default (jay: Jay) => {
	const moduler = createModuler(
		path.join(envPaths(packageJson.name).cache, 'packages')
	)

	const ask = createAsk(
		moduler,
		jay.stdin,
		jay.stdout
	)

	jay.context.require = moduler.require

	jay.on('line', async (line, stop) => {
		let required
		try {
			required = findRequired(line)
		} catch (error) {
			console.log(c.red(error))
			return stop(line)
		}

		if (required.errors.length > 0) {
			console.log(c.red(uniq(required.errors).join('\n')))
			return stop(line)
		}

		// Iterate over all required packages, install them if
		// they're not already, then log where they're getting
		// required from
		await processRequired({
			ask,
			moduler,
			required
		})

		return line
	})
}
