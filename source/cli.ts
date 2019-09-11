#!/usr/bin/env node

import path from 'path'

import envPaths from 'env-paths'
import figures from 'figures'
import semver from 'semver'
import updateNotifier from 'update-notifier'
import {default as c} from 'chalk'

import {
	Jay,
	DefaultPluggerTypes
} from './types'
import promptLine from './prompt'

import {createHistorian} from './history'
import {createPlugger} from './plugger'
import {createRc} from './rc'

import {
	addBuiltinsToObject,
	packageJson,
	debug,
	time
} from './util'

import {createContext} from './inspector'

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

async function main() {
	const historian = createHistorian(
		path.join(envPaths(packageJson.name).cache, 'history')
	)

	const plugger = createPlugger<DefaultPluggerTypes>({
		line: 'string',
		render: ['string', 'number'],
		keypress: {
			sequence: 'string',
			name: 'string',
			ctrl: 'boolean',
			meta: 'boolean',
			shift: 'boolean'
		}
	})

	const {context, contextId} = await createContext({})

	addBuiltinsToObject(context)

	const createPrompt = () => promptLine({
		history: historian.history,
		plugger
	})

	const jay: Jay = {
		stdout: process.stdout,
		stdin: process.stdin,
		plugger,
		on: plugger.on.bind(plugger),
		one: plugger.one.bind(plugger),
		context,
		contextId,
		prompt: createPrompt()
	}

	jay.context.jay = jay

	const configDir = envPaths(packageJson.name).config
	const rc = createRc(
		path.join(configDir, 'jayrc.js')
	)

	await rc.load(jay)

	let first = true
	async function processPrompt(): Promise<void> {
		if (first) {
			first = false
		} else {
			jay.prompt = createPrompt()
		}

		const result = await jay.prompt.resultsPromise

		if (result[0] === 'Line') {
			const line = result[1]

			if (line.length === 0) {
				processPrompt()
				return
			}

			historian.commit(line)

			const lineEnd = time('line')
			await plugger.dispatch('line', line)
			debug(lineEnd())

			processPrompt()

			return
		}

		if (result[0] === 'Exit') {
			process.exit()
		}

		if (result[0] === 'Abort') {
			processPrompt()

			return
		}

		throw new Error(`Received invalid command (${result[0]})`)
	}

	processPrompt()
}

main()
