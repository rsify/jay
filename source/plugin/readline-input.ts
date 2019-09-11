import {Jay} from '../types'

export = (jay: Jay) => {
	jay.on('keypress', (key, stop) => {
		jay.prompt.readlineInputStream.write(key.sequence)

		return stop(key)
	})
}
