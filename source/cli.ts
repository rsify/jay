#!/usr/bin/env node

import path from 'path'
import {inspect} from 'util'

import envPaths from 'env-paths'
import execa from 'execa'
import figures from 'figures'
import open from 'open'
import semver from 'semver'
import updateNotifier from 'update-notifier'
import wrapAnsi from 'wrap-ansi'
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
	createHistorian
} from './history'

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

if (semver.lt(process.version, '10.0.0')) {
	console.error(c.red(
		figures.cross,
		c.bold(packageJson.name),
		'requires at least',
		c.bold('node v10.0.0'),
		'to run.',
		`(you have ${c.bold(process.version)})`
	))

	process.exit(1)
}

updateNotifier({
	pkg: packageJson
}).notify()

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

function help() {
	open(packageJson.homepage)
}

function hello() {
	const version = (name: string, version: string) =>
		c.gray(c.bold.green(name) + '@' + version)

	console.log(
		c.yellow(`node ${process.version}`),
		version('npm', execa.sync('npm', ['-v']).stdout),
		version(packageJson.name, packageJson.version)
	)

	console.log(wrapAnsi(
		`${c.bold.magenta('jay is getting plugin support! Help us make the API suit you:')} ${c.gray('https://github.com/nikersify/jay/pull/18')}`,
		process.stdout.columns || Infinity
	))
}

async function main() {
	const historian = createHistorian(
		path.join(envPaths(packageJson.name).cache, 'history')
	)

	const moduler = createModuler(
		path.join(envPaths(packageJson.name).cache, 'packages')
	)

	const ask = createAsk(
		moduler,
		process.stdin,
		process.stdout
	)

	const {
		context,
		contextIdPromise,
		evaluate,
		pureEvaluate
	} = createEvaluator({
		require: moduler.require,
		jay: Object.seal(Object.create(null, {
			help: {
				value: help
			}
		}))
	})

	addBuiltinsToObject(context)

	const contextId = await contextIdPromise
	const completeFn = (line: string, cursor: number) =>
		complete(context, contextId, line, cursor)

	hello()

	async function processPrompt(): Promise<void> {
		const [command, payload] = await promptLine({
			history: historian.history,
			complete: completeFn,
			pureEvaluate
		})

		switch (command) {
			case Commands.Line: {
				const {line} = payload as LineResult

				if (line.length === 0) {
					processPrompt()
					break
				}

				historian.commit(line)

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
