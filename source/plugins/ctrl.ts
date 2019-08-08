import ansiEscapes from 'ansi-escapes'
import {default as c} from 'chalk'

import {Jay} from '../types'

export default (jay: Jay) => {
	// `ctrl+d` - exit the program
	jay.on('keypress', async key => {
		if (key.ctrl && key.name === 'd') {
			await jay.prompt.stop()
			// eslint-disable-next-line unicorn/no-process-exit
			process.exit(0)
		}

		return key
	})

	// `ctrl+c` - abort current line
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

	// `ctrl+l` - clear the screen
	jay.on('keypress', (key, stop) => {
		if (key.ctrl && key.name === 'l') {
			jay.stdout.write(ansiEscapes.cursorTo(0, 0))
			jay.stdout.write(ansiEscapes.eraseDown)

			return stop(key)
		}

		return key
	})

	// `ctrl+z` - send jay to shell background, aka. stop job
	jay.on('keypress', (key, stop) => {
		if (
			key.ctrl && key.name === 'z' &&
			process.platform !== 'win32'
		) {
			jay.prompt.setRawMode(false)

			process.once('SIGCONT', () => {
				jay.prompt.setRawMode(true)
				jay.prompt.rerender()
			})

			jay.stdout.write('\n')
			process.kill(process.pid, 'SIGTSTP')

			return stop(key)
		}

		return key
	})
}
