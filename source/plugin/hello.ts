import {default as c} from 'chalk'

import {Jay} from '../types'

import {packageJson} from '../util'

export = (_: Jay) => {
	const version = (name: string, version: string) =>
		c.gray(c.bold.green(name) + '@' + version)

	console.log(
		c.yellow(`node ${process.version}`),
		version(packageJson.name, packageJson.version)
	)
}
