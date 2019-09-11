import {Jay} from '../types'

export = (jay: Jay) =>
	jay.on('keypress', async (key, stop) => {
		if (key.name === 'return') {
			await jay.prompt.stop()

			jay.prompt.resolve([
				'Line',
				jay.prompt.readline.line
			])

			return stop(key)
		}

		return key
	})
