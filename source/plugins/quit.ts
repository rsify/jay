import {default as c} from 'chalk'

import {Jay} from '../types'

export default (jay: Jay) => {
	// `ctrl+d`
	jay.on('keypress', async key => {
		if (key.ctrl && key.name === 'd') {
			await jay.prompt.stop()
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(0)
		}

		return key
	})

	// `ctrl+c`
	jay.on('keypress', async (key, stop) => {
		if (key.ctrl && key.name === 'c') {
			await jay.prompt.stop()

			if (jay.prompt.readline.line === '') {
				jay.stdout.write(c.gray(
					`Press \`${c.bold('ctrl+d')}\` to exit.\n`
				))
			}

			jay.prompt.resolve([
				'Abort',
				undefined
			])

			return stop(key)
		}

		return key
	})
}
