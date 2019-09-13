import {emitKeypressEvents} from 'readline'

import ago from 's-ago'
import ansiEscapes from 'ansi-escapes'
import ora from 'ora'
import wrapAnsi from 'wrap-ansi'
import {default as c} from 'chalk'

import {Moduler} from './moduler'
import {KeypressDetails} from './prompt'

export interface Ask {
	install(name: string, version?: string): Promise<boolean>
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
export function getKeyPress(stream: NodeJS.ReadStream): Promise<KeypressDetails> {
	return new Promise(resolve => {
		if (!stream.isTTY || !stream.setRawMode) {
			return false
		}

		const setRawMode = (b: boolean) =>
			stream.setRawMode &&
			stream.setRawMode(b)

		const wasRaw = stream.isRaw || false

		setRawMode(true)
		stream.resume()

		emitKeypressEvents(stream)

		stream.once('keypress', (key: string | undefined, details: KeypressDetails) => {
			setRawMode(wasRaw)
			resolve(details)
			stream.pause()
		})
	})
}

export function createAsk(
	moduler: Moduler,
	inStream: NodeJS.ReadStream,
	outStream: NodeJS.WriteStream
): Ask {
	async function install(
		name: string,
		version = 'latest'
	): Promise<boolean> {
		const write = outStream.write.bind(outStream)

		const spinner = ora({
			text: `fetching ${c.bold.green(`${name}@${version}`)} info...`,
			stream: outStream
		})
		spinner.start()

		let info
		try {
			info = await moduler.info(name, version)
		} finally {
			write(ansiEscapes.eraseLine)
			spinner.stop()
		}

		const desc = info.description ?
			`\n- ${c.magenta(info.description)}\n` :
			''

		write(`
${c.bold.green(info.name)}${c.gray.bold(`@${info.version}`)} ${c('by')} ${c.bold.yellow(info.maintainers.join(', '))}
${desc}${c.gray('homepage:')} ${info.homepage}
${c.gray('license:')} ${info.license}
${c.gray('published:')} ${ago(new Date(info.published))}
${c.gray('dependencies:')} ${c.cyan(Object.keys(info.dependencies).length.toString())}
`.trim())

		const yn = c.gray('(Y/n)')
		const q =
		`${c.dim.bold('?')} ${c.green.bold(info.name)} was not found ` +
		'locally, would you like to install it to jay\'s cache?'

		write('\n\n' + wrapAnsi(`${q} ${yn}`, outStream.columns || Infinity) + ' ')
		write(ansiEscapes.cursorHide)

		const getK = async (): Promise<KeypressDetails> => {
			const key = await getKeyPress(inStream)

			const {name, ctrl} = key

			if (
				name === 'y' ||
				name === 'n' ||
				name === 'return' ||
				(name === 'c' && ctrl)
			) {
				return key
			}

			return getK()
		}

		const key = await getK()

		const answer = key.name === 'y' || key.name === 'return'

		if (!answer) {
			write(c.red('n'))
		}

		write(ansiEscapes.cursorShow)
		write('\n\n')

		return answer
	}

	return {
		install
	}
}
