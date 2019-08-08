import emphasize from 'emphasize'
import {default as c} from 'chalk'

import {Jay} from '../types'

export default (jay: Jay) => {
	jay.on('render', ([output, cursor]) => {
		/* eslint-disable @typescript-eslint/camelcase */
		const highlightSheet: emphasize.Sheet = {
			keyword: c.magenta,
			built_in: c.cyan.italic,
			literal: c.cyan,
			number: c.yellow,
			regexp: c.red,
			string: c.green,
			symbol: c.cyan,
			class: c.yellow.italic,
			attr: c.cyan,
			comment: c.gray
		}
		/* eslint-enable @typescript-eslint/camelcase */

		return [
			emphasize.highlight(
				'js',
				output,
				highlightSheet
			).value,
			cursor
		]
	})
}
