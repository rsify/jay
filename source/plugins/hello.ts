import {default as c} from 'chalk'
import execa from 'execa'
import wrapAnsi from 'wrap-ansi'

import {Jay} from '../types'

import {packageJson} from '../util'

export default (_: Jay) => {
	const version = (name: string, version: string) =>
		c.gray(c.bold.green(name) + '@' + version)

	console.log(
		c.yellow(`node ${process.version}`),
		version('npm', execa.sync('npm', ['-v']).stdout),
		version(packageJson.name, packageJson.version)
	)

	console.log(wrapAnsi(c.gray(
		'Type',
		`\`${(c.blue('> jay.help()'))}\``,
		'in the prompt for more information.'
	), process.stdout.columns || Infinity))
}
