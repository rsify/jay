import {Console} from 'console' // eslint-disable-line node/prefer-global/console
import {inspect} from 'util'

import chalk from 'chalk'

import {Jay} from '../types'

import {
	createEvaluator,
	ErrorResults,
	OutputResults
} from '../eval'

import {addGlobalsToObject} from '../util'

type Options = Partial<{
	eagerEval: boolean
	globals: boolean
	underscore: boolean
}>

export = (jay: Jay, _options?: Options) => {
	const options = {
		eagerEval: true,
		globals: true,
		underscore: true,
		..._options === undefined ? {} : _options
	}

	const {
		evaluate,
		pureEvaluate
	} = createEvaluator(jay.context, jay.contextId)

	if (options.globals) {
		addGlobalsToObject(jay.context)

		jay.context._ = undefined
		jay.context.console = new Console(
			jay.stdout,
			jay.stdin
		)

		jay.context.global = jay.context
	}

	// Evaluate input
	jay.on('line', async line => {
		const res = await evaluate(line)

		if (typeof (res as ErrorResults).error === 'undefined') {
			const {output} = res as OutputResults

			if (options.underscore) {
				jay.context._ = output
			}

			console.log(
				inspect(output, {colors: true})
			)
		} else {
			console.error((res as ErrorResults).error)
		}

		return line
	})

	// Add eager eval to the end of input
	if (options.eagerEval) {
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
}
