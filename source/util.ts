import {createWriteStream} from 'fs'
import {emitKeypressEvents} from 'readline'

import builtinModules from 'builtin-modules'
import readPkgUp from 'read-pkg-up'
import * as t from 'io-ts'
import {zip} from 'lodash'

import {KeypressDetails} from './prompt'

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
	const [, start] = process.hrtime()
	return () => `time ${title}: ${(process.hrtime()[1] - start) / 1e6}ms`
}

// Take a 2d array of string rows, return the sizes of the longest cells in
// each column
export function getColumnSizes(input: string[][]): number[] {
	return input.reduce((sizes, row) =>
		zip(sizes, row).map(([size, cell]) =>
			Math.max((cell || '').length, size || 0)
		), [] as number[])
}

export function returnError<T>(fn: () => T): T | Error {
	try {
		return fn()
	} catch (error) {
		return error
	}
}

export function getKeyPress(stream: NodeJS.ReadStream): Promise<KeypressDetails> {
	return new Promise(resolve => {
		if (!stream.isTTY || !stream.setRawMode) {
			return false
		}

		const setRawMode = (b: boolean) =>
			stream.setRawMode &&
			stream.setRawMode(b)

		const wasRaw = stream.isRaw || false

		setRawMode(true)
		stream.resume()

		emitKeypressEvents(stream)

		stream.once('keypress', (key: string | undefined, details: KeypressDetails) => {
			setRawMode(wasRaw)
			resolve(details)
			stream.pause()
		})
	})
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
				// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
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

// Reading package.json like this prevents typescript from nesting the "source"
// folder within dist - doing `import '../package.json'` from `source` creates
// `dist/package.json` and `dist/source/*`. This normally wouldn't be a big
// problem, apart from the fact that npm reads nested package.json files when
// publishing, completely messing up the "files" property that gets read not
// only from `/` but also `/source`. Since we have `dist` in the `files`
// package.json property, npm looks for `source/dist`, and only for that folder
// (which obviously doesn't exist within `source`).
export const packageJson = t.intersection([
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
]).decode((readPkgUp.sync({
	cwd: __dirname
}) || {package: {}}).package).getOrElseL(() => {
	throw new Error('Couldn\'t parse `package.json` - invalid format')
})
