import chalk from 'chalk'
import open from 'open'
import wrapAnsi from 'wrap-ansi'

import {Jay} from '../types'

import {packageJson} from '../util'

export default (jay: Jay) => {
	console.log(wrapAnsi(chalk.gray(
		'Type',
		`\`${(chalk.blue('> jay.help()'))}\``,
		'in the prompt for more information.'
	), process.stdout.columns || Infinity))

	Object.defineProperty(jay, 'help', {
		value() {
			open(packageJson.homepage)
		}
	})
}
