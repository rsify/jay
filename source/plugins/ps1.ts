import chalk from 'chalk'
import stripAnsi from 'strip-ansi'

import {Jay} from '../types'

export default (jay: Jay) => {
	jay.on('render', ([output, cursor]) => {
		const PS1 = chalk.bold.gray('> ')
		return [PS1 + output, cursor + stripAnsi(PS1).length]
	})
}
