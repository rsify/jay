import {Jay} from '../types'

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

export = (jay: Jay) =>
	jay.on('keypress', (key, stop) => {
		const rl = jay.prompt.readline
		const {name, sequence} = key

		const relativeCharacter = (offset: number): string | undefined =>
			rl.line[rl.cursor + offset]

		if (hasPrePair(sequence) && sequence === relativeCharacter(0)) {
			// Next character is a pair and is the same as the one entered, ghost it
			// input `)`: `(|)` -> `()|`

			rl.write('', {name: 'right'})

			return stop(key)
		}

		if (hasPostPair(sequence)) {
			// Append a matching pair character, place cursor inside
			// input `(`: `|` -> `(|)`
			const pair = getPair(sequence)
			if (pair === undefined) {
				throw new Error(`No pair for ${name}`)
			}

			rl.write(pair[0] + pair[1])
			rl.write('', {name: 'left'})

			return stop(key)
		}

		if (name === 'backspace') {
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

			return stop(key)
		}

		return key
	})
