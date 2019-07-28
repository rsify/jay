import vm from 'vm'

import {runtime} from './inspector'

// eslint-disable-next-line @typescript-eslint/ban-types
export function getAllPropertyNames(obj: object | Function): Completions {
	const proto = Object.getPrototypeOf(obj)
	const props = Object.getOwnPropertyNames(obj)

	return [props].concat(proto ? getAllPropertyNames(proto) : [])
}

export async function getGlobalLexicalScopeNames(contextId: number): Promise<string[]> {
	const {names} = await runtime.globalLexicalScopeNames({
		executionContextId: contextId
	})

	return names
}

const moveItemToStart = <T>(item: T, array: T[]): T[] => {
	const index = array.indexOf(item)

	if (index === -1) {
		return array
	}

	return [array[index]].concat(array.slice(0, index), array.slice(index + 1))
}

export type Completions = string[][]
export interface CompletionsMeta {
	// The target based on which completions are being filtered on,
	// e.g. for `console.lo` completee = `lo`. While a completion
	// is active, this can be used to easily strip off the "filter"
	// part of the completion (in this case `lo`) and replace it
	// with the full completion (`log`).
	completee?: string
	completions: Completions
}

// Create relevant code completions for the given `context` and `line`, at
// `cursor`.
export default async (
	context: vm.Context,
	contextId: number,
	line: string,
	cursor: number
): Promise<CompletionsMeta> => {
	if (!vm.isContext(context)) {
		throw new TypeError(
			'Expected `context` to be vm.Context: ' +
			'https://nodejs.org/api/vm.html#vm_what_does_it_mean_to' +
			'_contextify_an_object'
		)
	}

	if (line === '') {
		return {
			completions: [Object.getOwnPropertyNames(context)]
		}
	}

	// To prevent weird completions, if the cursor is not at the end of the
	// line, ensure that the only characters after it are closing brackets.
	// This also handles situations when cursor is inside of a string.
	if (line.slice(cursor).split('').some(x => ![')', '}', ']'].includes(x))) {
		return {
			completions: []
		}
	}

	// A simple regex based implementation, can experiment with ast walking
	// in the future.
	// Gets the last variable in the line, in case of an object separating the
	// last property accessor, e.g. 'this.is.epic' turns into
	// ['this.is', '.epic']
	const res = /(\w*(?:\.\w*)*?)(\.\w*)?$/.exec(line.slice(0, cursor))

	if (!res) {
		return {
			completions: []
		}
	}

	const [, variable, filter] = res

	const ret = (completions: Completions) => ({
		completee: filter ? filter.slice(1) : variable,
		completions
	})

	const filtered = (filter: string) => (levels: Completions): Completions =>
		filter ?
			levels.map(level =>
				moveItemToStart(
					filter,
					level.filter(item =>
						item.startsWith(filter)
					)
				)
			).filter(arr => arr.length > 0) :
			levels

	let variableInstance
	try {
		variableInstance = vm.runInContext(
			variable,
			context
		)
	} catch (_) {
		const completions = [await getGlobalLexicalScopeNames(contextId)].concat(
			getAllPropertyNames(context)
		)

		return {
			completee: variable + (filter ? filter : ''),
			completions: filtered(variable)(completions)
		}
	}

	if (
		variableInstance !== null && variableInstance !== undefined
	) {
		if (filter) {
			return ret(
				filtered(filter.slice(1))(getAllPropertyNames(variableInstance))
			)
		}

		return ret(
			filtered(variable)(getAllPropertyNames(context))
		)
	}

	return ret([])
}
