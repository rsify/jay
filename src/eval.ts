import {Console} from 'console' // eslint-disable-line node/prefer-global/console
import {Context, Script} from 'vm'

import {LooseObject} from './util'

import {createContext, Runtime} from './inspector'

export interface ErrorResults {
	error: Error
}

export interface OutputResults {
	output: any
}

export type EvaluationResults = ErrorResults | OutputResults

export type Evaluator = (line: string) => Promise<EvaluationResults>

export class SideEffectError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'SideEffectError'
	}
}

export function createEvaluator(ctx: LooseObject = {}): {
	context: Context
	evaluate: Evaluator
	pureEvaluate: Evaluator
} {
	const template: LooseObject = {}

	Object.getOwnPropertyNames(global).forEach(name => {
		if (name === 'global') {
			return
		}

		const descriptor =
			Object.getOwnPropertyDescriptor(global, name)

		if (typeof descriptor !== 'undefined') {
			Object.defineProperty(
				template,
				name,
				descriptor
			)
		}
	})

	template._ = undefined
	template.console = new Console(
		process.stdout,
		process.stdin
	)

	// Get only enumerable properties with `Object.keys`
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties
	Object.keys(ctx).forEach(key => {
		template[key] = ctx[key]
	})

	template.global = template

	const {context, contextIdPromise} = createContext(template)

	// Lines like `{a: 1}` will be treated as a block statement
	// by the eval function rather than an expression statement -
	// we have to surround it with brackets to get output desired
	// in a REPL.
	const wrapIfNeeded = (line: string) =>
		line.startsWith('{') && line.endsWith('}') ?
			`(${line})` :
			line

	const evaluate: Evaluator = async line => {
		line = wrapIfNeeded(line)

		const script = new Script(line)

		try {
			const output = await script.runInContext(context)
			context._ = output

			return {output}
		} catch (error) {
			return {error}
		}
	}

	// Bugged due to https://github.com/nodejs/node/issues/27518, will be used
	// for eager eval in the future.
	const pureEvaluate: Evaluator = async line => {
		line = wrapIfNeeded(line)

		const output = await Runtime.evaluate({
			expression: line,
			silent: true,
			contextId: await contextIdPromise,
			generatePreview: true,
			throwOnSideEffect: true
		})

		if (output.exceptionDetails) {
			const {description} = output.exceptionDetails.exception

			if (description.startsWith('EvalError: Possible side-effect in')) {
				console.log(description)
				return {
					error: new SideEffectError(
						'Possible side-effect during evaluation'
					)
				}
			}

			return {
				error: new Error(description)
			}
		}

		return {
			output: output.result
		}
	}

	return {
		context,
		evaluate,
		pureEvaluate
	}
}
