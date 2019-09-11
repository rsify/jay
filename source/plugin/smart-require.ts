import path from 'path'

import envPaths from 'env-paths'
import {default as c} from 'chalk'
import {uniq} from 'lodash'

import {Jay} from '../types'

import {
	createModuler,
	findRequired,
	processRequired
} from '../moduler'

import {createAsk} from '../ask'
import {packageJson} from '../util'

export = (jay: Jay) => {
	const moduler = createModuler(
		path.join(envPaths(packageJson.name).cache, 'packages'),
		process.cwd(),
		['relative', 'node_modules', 'global cache']
	)

	const ask = createAsk(
		moduler,
		jay.stdin,
		jay.stdout
	)

	jay.context.require = moduler.require

	jay.on('line', async (line, stop) => {
		let required
		try {
			required = findRequired(line)
		} catch (error) {
			console.log(c.red(error))
			return stop(line)
		}

		if (required.errors.length > 0) {
			console.log(c.red(uniq(required.errors).join('\n')))
			return stop(line)
		}

		// Iterate over all required packages, install them if
		// they're not already, then log where they're getting
		// required from
		await processRequired({
			ask,
			moduler,
			required
		})

		return line
	})
}
