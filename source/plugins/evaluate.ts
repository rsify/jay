import {inspect} from 'util'

import {Jay} from '../types'
import {
	createEvaluator,
	ErrorResults,
	OutputResults
} from '../eval'

export default (jay: Jay) => {
	const {
		evaluate
	} = createEvaluator(jay.context, jay.contextId)

	// Evaluate input
	jay.on('line', async line => {
		const res = await evaluate(line)

		if (typeof (res as ErrorResults).error === 'undefined') {
			console.log(
				inspect((res as OutputResults).output, {colors: true})
			)
		} else {
			console.error((res as ErrorResults).error)
		}

		return line
	})
}
