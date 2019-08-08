import wrapAwait from 'wrap-await'
import chalk from 'chalk'

import {Jay} from '../types'

export default (jay: Jay) => {
	jay.on('line', (line, stop) => {
		try {
			return wrapAwait(line) || line
		} catch (error) {
			console.log(chalk.red(error))
			return stop(line)
		}
	})
}
