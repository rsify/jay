import {EventEmitter} from 'events'

import {
	createInterface as createReadLineInterface,
	emitKeypressEvents
} from 'readline'

import {PassThrough} from 'stream'

import ansiEscapes from 'ansi-escapes'
import stripAnsi from 'strip-ansi'

import {
	_ReadLineOptions,
	_ReadLineInterface,
	Prompt,
	PromptResults
} from './types'

import {CompletionsMeta} from './complete'
import {Plugger} from './plugger'
import {debug, time} from './util'

export interface KeypressDetails {
	sequence: string
	name: string
	ctrl: boolean
	meta: boolean
	shift: boolean
}

export type CompletionFunction =
	(line: string, cursor: number) => Promise<CompletionsMeta>

export default function promptLine({
	history, plugger
}: {
	history: string[]
	plugger: Plugger<{
		render: ['string', 'number']
		keypress: {
			sequence: 'string'
			name: 'string'
			ctrl: 'boolean'
			meta: 'boolean'
			shift: 'boolean'
		}
	}>
}): Prompt {
	const {stdin, stdout} = process

	const setRawMode = (b: boolean): void => stdin.setRawMode && stdin.setRawMode(b)

	if (!stdin.setRawMode) {
		throw new Error('process.stdin.setRawMode does not exist')
	}

	setRawMode(true)
	stdin.resume()

	const readlineInputStream = new PassThrough()

	const readline = createReadLineInterface({
		input: readlineInputStream,
		terminal: true,
		escapeCodeTimeout: 10
	} as _ReadLineOptions) as _ReadLineInterface

	emitKeypressEvents(stdin, readline)

	readline.history = history

	let cursorPosition: [number, number] = [0, 0]

	function clearPrompt(): void {
		debug(`cursorMove(${-cursorPosition[0]}, ${-cursorPosition[1]})`)
		stdout.write(ansiEscapes.cursorMove(
			-cursorPosition[0],
			-cursorPosition[1]
		))

		debug('eraseDown')
		stdout.write(ansiEscapes.eraseDown)
	}

	async function rerender() {
		const rerenderTime = time('rerender')

		clearPrompt()

		const [output, cursor] = await plugger.dispatch('render', [readline.line, readline.cursor])

		debug(`readline.line = ${readline.line}`)
		debug(`readline.cursor = ${readline.cursor}`)
		debug(`output = ${output}`)
		debug(`cursor = ${cursor}`)

		stdout.write(output + ' ')

		const cols = stdout.columns || Infinity
		// Since cursor moves when writing text, revert it
		// back to the first line
		const rowsToGoUp = Math.floor((stripAnsi(output).length) / cols)

		debug(`cursorMove(0, ${-rowsToGoUp})`)
		stdout.write(ansiEscapes.cursorMove(0, -rowsToGoUp))

		// Move cursor into proper position
		cursorPosition = [
			cursor % cols,
			Math.floor(cursor / cols)
		]

		debug(`cursorPosition = ${cursorPosition}`)
		debug('cursorTo(0)')
		stdout.write(ansiEscapes.cursorTo(0))

		debug(`cursorMove(${cursorPosition})`)
		stdout.write(ansiEscapes.cursorMove(...cursorPosition))

		debug(rerenderTime())
	}

	function resizeListener(): void {
		rerender()
	}

	let stopping = false

	async function keypressListener(
		key: string | undefined,
		details: KeypressDetails
	) {
		const keyTime = time('key')

		if (key) {
			debug('key ' + Buffer.from(key).toString('hex'))
		}

		debug('sequence ' + Buffer.from(details.sequence).toString('hex'))
		debug('details ' + JSON.stringify(details))

		await plugger.dispatch('keypress', details)

		if (!stopping) {
			await rerender()
		}

		debug(keyTime())
	}

	stdout.on('resize', resizeListener)
	stdin.on('keypress', keypressListener)

	// `nextTick`ing this to allow render plugins to register
	// before the first render
	process.nextTick(rerender)

	async function stop() {
		stopping = true

		await rerender()

		stdin.removeListener('keypress', keypressListener)
		stdout.removeListener('resize', resizeListener)
		stdout.write('\n')

		setRawMode(false)

		readlineInputStream.destroy()
		stdin.pause()
		readline.close()
	}

	const o = new EventEmitter()
	const resolve = (value: PromptResults) => o.emit('resolved', value)

	const resultsPromise: Promise<PromptResults> = new Promise(resolve => {
		o.on('resolved', (value: PromptResults) => resolve(value))
	})

	return {
		readline,
		readlineInputStream,
		rerender,
		resolve,
		resultsPromise,
		setRawMode,
		stop
	}
}
