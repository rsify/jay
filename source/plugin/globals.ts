import {Console} from 'console' // eslint-disable-line node/prefer-global/console

import {Jay} from '../types'

export = (jay: Jay) => {
	Object.getOwnPropertyNames(global).forEach(name => {
		if (name === 'global') {
			return
		}

		const descriptor =
			Object.getOwnPropertyDescriptor(global, name)

		if (typeof descriptor !== 'undefined') {
			Object.defineProperty(
				jay.context,
				name,
				descriptor
			)
		}
	})

	jay.context._ = undefined
	jay.context.console = new Console(
		jay.stdout,
		jay.stdin
	)

	jay.context.global = jay.context
}
