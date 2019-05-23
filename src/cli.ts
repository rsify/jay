#!/usr/bin/env node

import path from 'path'
import {inspect} from 'util'

import envPaths from 'env-paths'

import figures from 'figures'
import wrapAwait from 'wrap-await'
import {default as c} from 'chalk'
import {uniq} from 'lodash'

import complete from './complete'
import promptLine from './prompt'
import {Commands, LineResult} from './commands'

import {
	createEvaluator,
	OutputResults,
	ErrorResults
} from './eval'

import {
	FindRequiredOutput,
	Moduler,
	RegistryError,
	createModuler,
	findRequired
} from './moduler'

import {
	addBuiltinsToObject,
	packageJson,
	returnError
} from './util'
import {Ask, createAsk} from './ask'

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
						`in ${Math.round(installed.elapsed / 10000) * 10000}s!` :
						'!'
				))
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

function main(): void {
	const history: string[] = []

	const moduler = createModuler(
		path.join(envPaths(packageJson.name).cache, 'packages')
	)

	const ask = createAsk(
		moduler,
		process.stdin,
		process.stdout
	)

	const {context, evaluate} = createEvaluator({
		require: moduler.require
	})

	addBuiltinsToObject(context)

	const completeFn = (line: string, cursor: number) =>
		complete(context, line, cursor)

	async function processPrompt(): Promise<void> {
		const [command, payload] = await promptLine(history, completeFn)

		switch (command) {
			case Commands.Line: {
				const {line} = payload as LineResult
				history.unshift(line)

				let wrappedLine
				let required
				try {
					wrappedLine = wrapAwait(line) || line

					required = findRequired(wrappedLine)
				} catch (error) {
					console.log(c.red(error))

					processPrompt()
					break
				}

				if (required.errors.length > 0) {
					console.log(c.red(uniq(required.errors).join('\n')))
				} else {
					// Iterate over all required packages, install them if
					// they're not already, then log where they're getting
					// required from
					await processRequired({
						ask,
						moduler,
						required
					})

					const res = await evaluate(wrappedLine)

					if (typeof (res as ErrorResults).error === 'undefined') {
						console.log(
							inspect((res as OutputResults).output, {colors: true})
						)
					} else {
						console.error((res as ErrorResults).error)
					}
				}

				processPrompt()
				break
			}

			case Commands.Exit: {
				process.exit()
			}

			case Commands.Abort: {
				processPrompt()
				break
			}

			default: {
				throw new Error(`Received invalid command (${command})`)
			}
		}
	}

	processPrompt()
}

main()
