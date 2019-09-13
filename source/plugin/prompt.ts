import chalk from 'chalk'
import stripAnsi from 'strip-ansi'

import {Jay} from '../types'

type Options = Partial<{
	prompt: string
}>

export = (jay: Jay, _options?: Options) => {
	const options = {
		prompt: '> ',
		..._options === undefined ? {} : _options
	}

	jay.on('render', ([output, cursor]) => {
		const prompt = chalk.bold.gray(options.prompt)
		return [prompt + output, cursor + stripAnsi(prompt).length]
	})
}
