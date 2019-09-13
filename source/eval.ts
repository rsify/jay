import {Script} from 'vm'

import semver from 'semver'

import {LooseObject} from './util'
import {
	EvaluateReturnType,
	runtime
} from './inspector'

export interface ErrorResults {
	error: Error
}

export interface OutputResults {
	output: any
}

export type EvaluationResults = ErrorResults | OutputResults

export type Evaluator = (line: string) => Promise<EvaluationResults>

// This function executes code via v8's inspector api, hence the only returned
// thing is a stringified representation of the resulting object.
export type PureEvaluator = (line: string) => Promise<string | undefined>

function prettyPrintEvaluateResults(result: EvaluateReturnType['result']) {
	if (result.type === 'undefined') {
		return 'undefined'
	}

	if (result.type === 'string') {
		return `"${result.value}"`
	}

	if (result.type === 'number') {
		if (result.value) {
			return result.value.toString()
		}

		// Handles Nan's & Infinities
		return result.description
	}

	if (result.type === 'boolean') {
		return result.value.toString()
	}

	if (result.type === 'symbol') {
		return result.description
	}

	if (result.type === 'function') {
		return 'function'
	}

	if (result.type === 'object') {
		if (result.subtype === 'null') {
			return 'null'
		}

		if (result.subtype === 'array') {
			return result.description
		}

		if (result.subtype === 'regexp') {
			return result.description
		}

		if (result.subtype === 'date' && result.description) {
			return new Date(result.description).toISOString()
		}

		if (['map', 'set'].includes(result.subtype || '') && result.preview && result.preview.entries) {
			return `${result.className} { ${result.preview.entries.length} elements }`
		}

		if (result.subtype === 'error') {
			return result.className
		}

		return 'Object'
	}
}

export type EvaluatorResult = {
	evaluate: Evaluator
	pureEvaluate: PureEvaluator
}

export function createEvaluator(
	context: LooseObject = {},
	contextId: number
): EvaluatorResult {
	// Lines like `{a: 1}` will be treated as a block statement
	// by the eval function rather than an expression statement -
	// we have to surround it with brackets to get output desired
	// in a REPL.
	const wrapIfNeeded = (line: string) =>
		line.startsWith('{') && line.endsWith('}') ?
			`(${line})` :
			line

	const evaluate = async (line: string) => {
		line = wrapIfNeeded(line)

		const script = new Script(line)

		try {
			const output = await script.runInContext(context)

			return {output}
		} catch (error) {
			return {error}
		}
	}

	const pureEvaluate = async (line: string) => {
		if (semver.lt(process.version, '12.3.0')) {
			// Not supported before because of
			// https://github.com/nodejs/node/issues/27518
			return undefined
		}

		line = wrapIfNeeded(line)

		let output
		try {
			output = await runtime.evaluate({
				awaitPromise: true,
				contextId,
				expression: line,
				generatePreview: true,
				silent: true,
				throwOnSideEffect: true,
				timeout: 500,
				userGesture: true
			})
		} catch {
			return undefined
		}

		if (output.exceptionDetails) {
			return undefined
		}

		const {result} = output as EvaluateReturnType

		return prettyPrintEvaluateResults(result)
	}

	return {
		evaluate,
		pureEvaluate
	}
}
