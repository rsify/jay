import {inspect} from 'util'

import chalk from 'chalk'

import {Jay} from '../types'
import {
	createEvaluator,
	ErrorResults,
	OutputResults
} from '../eval'

export default (jay: Jay) => {
	const {
		evaluate,
		pureEvaluate
	} = createEvaluator(jay.context, jay.contextId)

	// Evaluate input
	jay.on('line', async line => {
		const res = await evaluate(line)

		if (typeof (res as ErrorResults).error === 'undefined') {
			console.log(
				inspect((res as OutputResults).output, {colors: true})
			)
		} else {
			console.error((res as ErrorResults).error)
		}

		return line
	})

	// Add eager eval to the end of input
	jay.on('render', async ([output, cursor]): Promise<[string, number]> => {
		const {line} = jay.prompt.readline
		if (line.length > 0) {
			const result = await pureEvaluate(line)

			if (result) {
				return [
					output + chalk.gray(` // ${result}`),
					cursor
				]
			}
		}

		return [output, cursor]
	})
}
