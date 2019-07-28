import {
	Interface as ReadLineInterface,
	ReadLineOptions,
	createInterface as createReadLineInterface,
	emitKeypressEvents
} from 'readline'

import {PassThrough} from 'stream'

import ansiEscapes from 'ansi-escapes'
import emphasize from 'emphasize'
import sliceAnsi from 'slice-ansi'
import stripAnsi from 'strip-ansi'
import {clamp, flatten, times, uniqBy} from 'lodash'
import {default as c} from 'chalk'

import * as scroll from './scroll'
import {Commands, PromptResult} from './commands'
import {CompletionsMeta} from './complete'
import {PureEvaluator} from './eval'
import {debug, getColumnSizes, time} from './util'

export interface KeypressDetails {
	sequence: string
	name: string
	ctrl: boolean
	meta: boolean
	shift: boolean
}

type Pair = [string, string]
const pairs: Pair[] = [
	['\'', '\''],
	['"', '"'],
	['`', '`'],
	['(', ')'],
	['{', '}'],
	['[', ']']
]

const getPair = (ch: string): Pair | undefined => pairs.find(p => p[0] === ch)
const hasXPair = (x: 0 | 1) => (ch: string) => pairs.map(p => p[x]).includes(ch)
const hasPostPair = hasXPair(0)
const hasPrePair = hasXPair(1)

const noop = <T>(x: T): T => x

export type CompletionFunction =
	(line: string, cursor: number) => Promise<CompletionsMeta>

const OPTIONS = {
	menuHeight: 5
}

/* eslint-disable @typescript-eslint/camelcase */
const highlightSheet: emphasize.Sheet = {
	keyword: c.magenta,
	built_in: c.cyan.italic,
	literal: c.cyan,
	number: c.yellow,
	regexp: c.red,
	string: c.green,
	symbol: c.cyan,
	class: c.yellow.italic,
	attr: c.cyan,
	comment: c.gray
}
/* eslint-enable @typescript-eslint/camelcase */

export default function promptLine({
	history, complete, pureEvaluate
}: {
	history: string[]
	complete: CompletionFunction
	pureEvaluate: PureEvaluator
}): Promise<PromptResult> {
	return new Promise(resolve => {
		const pre = c.bold.gray('> ')

		const {stdin, stdout} = process

		if (!stdin.setRawMode) {
			throw new Error('process.stdin.setRawMode does not exist')
		}

		const setRawMode = (b: boolean): void => stdin.setRawMode && stdin.setRawMode(b)

		setRawMode(true)
		stdin.resume()

		const readlineInputStream = new PassThrough()

		// This seems to have been pretty poorly typed...
		type _ReadLineOptions = ReadLineOptions & {escapeCodeTimeout: number}
		const rl = createReadLineInterface({
			input: readlineInputStream,
			terminal: true,
			escapeCodeTimeout: 10
		} as _ReadLineOptions) as ReadLineInterface & {
			cursor: number
			line: string
			history: string[]
		}

		emitKeypressEvents(stdin, rl)

		rl.history = history

		let rendered = ''
		let cursorPosition: [number, number] = [0, 0]
		let menuItems: Array<[string, string]> = []
		let stopping = false
		let eager: string | undefined

		// If `scroller` is not undefined, completion menu is open
		let scroller: scroll.ScrollInfo | undefined
		let completee: string | undefined

		function clearPrompt(): void {
			debug(`cursorMove(${-cursorPosition[0]}, ${-cursorPosition[1]})`)
			stdout.write(ansiEscapes.cursorMove(
				-cursorPosition[0],
				-cursorPosition[1]
			))

			debug('eraseDown')
			stdout.write(ansiEscapes.eraseDown)
		}

		function renderPrompt(): void {
			const cols = stdout.columns || Infinity
			const completion = scroller && menuItems.length > 0 ?
				menuItems[scroller.selected === -1 ? 0 : scroller.selected][0] :
				''

			const lineHighlightTime = time('lineHighlight')
			const highlightedLine =
				emphasize.highlight('js', rl.line, highlightSheet).value
			debug(lineHighlightTime())

			const slice = (start: number, end?: number) =>
				sliceAnsi(highlightedLine, start, end)

			const beforeCursor = (() => {
				const sliced = slice(0, rl.cursor)

				if (menuItems.length === 0) {
					return sliced
				}

				if (
					((scroller && scroller.selected === -1) || !scroller) &&
					!stopping
				) {
					return sliced + c.gray(
						menuItems[0][0].slice((completee || '').length)
					)
				}

				return sliced
			})()

			const afterCursor = slice(rl.cursor)

			debug(`rl.line = ${rl.line}`)
			debug(`rl.cursor = ${rl.cursor}`)
			debug(`completion = ${completion}`)
			debug('beforeCursor = ' + beforeCursor)
			debug('afterCursor = ' + afterCursor)

			const out =
				pre +
				beforeCursor +
				afterCursor +
				' ' + (eager ? c.gray(`// ${eager}`) : '')

			debug('out')
			stdout.write(out)

			const offset = rl.cursor + stripAnsi(pre).length
			cursorPosition = [
				offset % cols,
				Math.floor(offset / cols)
			]

			const rowsToGoUp = Math.floor((stripAnsi(out).length - 1) / cols)

			debug(`cursorMove(0, ${-rowsToGoUp})`)
			stdout.write(ansiEscapes.cursorMove(0, -rowsToGoUp))

			rendered = out
		}

		function rerender(): void {
			const rerenderTime = time('rerender')

			clearPrompt()
			renderPrompt()

			if (scroller && menuItems.length > 1) {
				stdout.write('\n')
				renderMenu()
			}

			// Move cursor into proper position
			debug('cursorTo(0)')
			stdout.write(ansiEscapes.cursorTo(0))

			debug(`cursorMove(${cursorPosition})`)
			stdout.write(ansiEscapes.cursorMove(...cursorPosition))

			debug(rerenderTime())
		}

		function renderMenu(): void {
			const menuTime = time('menu')

			if (scroller === undefined) {
				throw new Error('scroller was undefined while trying to render menu')
			}

			const cols = stdout.columns || Infinity

			const menuPosition = completee !== undefined && scroller.selected !== -1 ?
				rl.cursor - menuItems[scroller.selected][0].length + completee.length :
				rl.cursor

			debug(`menuPosition: ${menuPosition}`)

			const _offset = ((stripAnsi(pre).length + menuPosition) % cols) - 1

			const down = Math.floor(
				(stripAnsi(rendered).length - 1) / cols
			)

			debug(`down: ${down}`)
			stdout.write(ansiEscapes.cursorMove(0, down))

			const columnSizes = getColumnSizes(menuItems)
			debug(`columnSizes: ${columnSizes}`)

			const lines = menuItems.map(([name, kind]) =>
				' ' +
				name.padEnd(columnSizes[0]) +
				' ' +
				kind.padEnd(columnSizes[1]) +
				' '
			)

			// + 1 because of the scrollbar
			const maxRenderLength = Math.max(...lines.map(l => l.length)) + 1

			const scrollbar = scroll.generateScrollbar(scroller)
			debug(`scrollbar ${JSON.stringify(scrollbar)}`)

			const cap = cols - maxRenderLength
			const offset = clamp(_offset, 0, cap)
			debug(`offset: ${offset}`)

			debug(`menuSelectedIndex: ${scroller.selected}`)

			for (let i = scroller.start; i <= scroller.end; i++) {
				const line = lines[i]

				const selected = i === scroller.selected

				const lineStyleFn =
					selected ?
						c.bgBlackBright :
						noop

				const renderedRowNumber = i - scroller.start
				debug(`renderedRowNumber ${renderedRowNumber}`)
				const showScrollbarChar =
					scrollbar.offset <= renderedRowNumber &&
					renderedRowNumber < (scrollbar.offset + scrollbar.size) &&
					scrollbar.size !== menuItems.length

				const scrollCharFn = showScrollbarChar ?
					c.bgBlackBright :
					noop

				stdout.write(ansiEscapes.cursorMove(offset))
				stdout.write(
					c.bgWhite.black(
						lineStyleFn(
							line + scrollCharFn(' ')
						)
					) + '\n'
				)
			}

			stdout.write(ansiEscapes.cursorMove(0, -(scroller.end - scroller.start) - 2))
			stdout.write(ansiEscapes.cursorMove(0, -down))
			stdout.write(ansiEscapes.cursorTo(0))

			debug(menuTime())
		}

		// eslint-disable-next-line complexity
		async function keypressListener(
			key: string | undefined,
			details: KeypressDetails
		): Promise<void> {
			const keyTime = time('key')

			const {shift, ctrl, name, sequence} = details

			if (key) {
				debug('key ' + Buffer.from(key).toString('hex'))
			}

			debug('sequence ' + Buffer.from(details.sequence).toString('hex'))
			debug('details ' + JSON.stringify(details))

			// Character in the position x, where x is the offset from cursor
			const relativeCharacter = (offset: number): string | undefined =>
				rl.line[rl.cursor + offset]

			if (scroller === undefined && name === 'tab' && menuItems.length > 0) {
				scroller = scroll.createScroller(menuItems.length, OPTIONS.menuHeight)
			}

			if (name === 'tab') {
				if (scroller) {
					const _completee = completee || ''

					const previousSelectedItem = scroller.selected === -1 ?
						'' :
						menuItems[scroller.selected][0]

					const charAmountToDelete = scroller.selected === -1 ?
						0 :
						previousSelectedItem.length - _completee.length

					if (shift) {
						debug('previousItem')
						scroller = scroll.previousItem(scroller)
					} else {
						debug('nextItem')
						scroller = scroll.nextItem(scroller)
					}

					const selectedItem = scroller.selected === -1 ?
						'' :
						menuItems[scroller.selected][0]

					debug(`charAmountToDelete = ${charAmountToDelete}`)

					times(charAmountToDelete, () => {
						rl.write('', {name: 'backspace'})
					})

					rl.write(selectedItem.slice(_completee.length))
				}
			} else if (name === 'escape') {
				scroller = undefined
				menuItems = []
			} else if (ctrl && name === 'd') {
				stop()

				return resolve([Commands.Exit, {}])
			} else if (ctrl && name === 'c') {
				stop()

				if (rl.line === '') {
					stdout.write(c.gray(`Press \`${c.bold('ctrl+d')}\` to exit.\n`))
				}

				return resolve([Commands.Abort, {}])
			} else if (ctrl && name === 'l') {
				stdout.write(ansiEscapes.cursorTo(0, 0))
				stdout.write(ansiEscapes.eraseDown)
			} else if (ctrl && name === 'z' && process.platform !== 'win32') {
				setRawMode(false)

				process.once('SIGCONT', () => {
					setRawMode(true)
					rerender()
				})

				stdout.write('\n')
				process.kill(process.pid, 'SIGTSTP')
			} else if (name === 'return') {
				stop()
				return resolve([Commands.Line, {line: rl.line}])
			} else if (hasPrePair(sequence) && sequence === relativeCharacter(0)) {
				// Next character is a pair and is the same as the one entered, ghost it
				// input `)`: `(|)` -> `()|`

				rl.write('', {name: 'right'})
			} else if (hasPostPair(sequence)) {
				// Append a matching pair character, place cursor inside
				// input `(`: `|` -> `(|)`
				const pair = getPair(sequence)
				if (pair === undefined) {
					throw new Error(`No pair for ${name}`)
				}

				rl.write(pair[0] + pair[1])
				rl.write('', {name: 'left'})
			} else if (name === 'backspace') {
				const characterToDelete = relativeCharacter(-1)
				const nextCharacter = relativeCharacter(0)

				// Delete a matching pair character if exists
				// input `<backspace>`: `(|)` -> `|`
				if (characterToDelete !== undefined && hasPostPair(characterToDelete)) {
					const pair = getPair(characterToDelete)
					if (pair && pair[1] === nextCharacter) {
						// Matching pair, delete one character after cursor
						rl.write('', {name: 'delete'})
					}
				}

				// Bubble down default behaviour
				rl.write('', {name: 'backspace'})
			} else {
				readlineInputStream.write(sequence)
			}

			if (rl.line === '' || name === 'escape') {
				scroller = undefined
				menuItems = []
			} else if (name !== 'tab' || scroller === undefined) {
				const completionsTime = time('completions')
				const result = await complete(rl.line, rl.cursor)
				debug(completionsTime())

				completee = result.completee

				menuItems = uniqBy(
					flatten(result.completions).map(c => ([
						c,
						'?'
					])),
					x => x[0]
				)
			}

			if (name !== 'tab') {
				scroller = undefined
			}

			debug(`scroller = ${JSON.stringify(scroller)}`)

			if (rl.line.length > 0) {
				const eagerEvalTime = time('eagerEval')
				eager = await pureEvaluate(rl.line)
				debug(eagerEvalTime())
			} else {
				eager = undefined
			}

			rerender()

			debug(keyTime())
		}

		function resizeListener(): void {
			rerender()
		}

		stdout.on('resize', resizeListener)
		stdin.on('keypress', keypressListener)

		rerender()

		function stop(): void {
			stopping = true

			if (scroller) {
				// Clear menu on the way out

				scroller = undefined
				menuItems = []
			}

			rerender()

			stdin.removeListener('keypress', keypressListener)
			stdout.removeListener('resize', resizeListener)
			stdout.write('\n')

			setRawMode(false)

			readlineInputStream.destroy()
			stdin.pause()
			rl.close()
		}
	})
}
