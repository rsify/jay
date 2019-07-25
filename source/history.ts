import fs from 'fs'
import path from 'path'

import makeDir from 'make-dir'

// `history` stores the most recent entry in history[0]
// `filePath` contains history with the most recent entry as the
// last line. This is so as to allow appending the file, rather
// than replacing it as a whole.
export function createHistorian(filePath: string) {
	const directoryPath = path.dirname(filePath)
	makeDir.sync(directoryPath)

	fs.closeSync(fs.openSync(filePath, 'a')) // Touch the history file

	const lines = fs.readFileSync(filePath, 'utf-8')
		.trim()
		.split('\n')

	if (lines.length > 1000) {
		fs.writeFileSync(filePath, lines.slice(-1000).join('\n') + '\n')
	}

	const history = lines.slice(-1000).reverse()

	function commit(line: string): void {
		history.unshift(line)
		const fd = fs.openSync(filePath, 'a')
		fs.writeSync(fd, `${line}\n`)
		fs.closeSync(fd)
	}

	return {
		commit,
		history
	}
}
