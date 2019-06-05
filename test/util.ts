import test from 'ava'

import {
	LooseObject,
	addBuiltinsToObject,
	getColumnSizes,
	returnError,
	packageJson
} from '../source/util'

test('getColumnSizes', t => {
	const cases: Array<[string[][], number[]]> = [
		[[], []],
		[[['1'], ['3']], [1]],
		[[['one', 'two'], ['three', 'a'], ['b', 'cd']], [5, 3]],
		[[['hello', 'world', 'this'], ['is', 'pointless', 'lorem']], [5, 9, 5]]
	]

	cases.forEach(([input, expected]) => {
		t.deepEqual(getColumnSizes(input), expected)
	})
})

test('returnError', t => {
	const e = new Error()

	const throwy = (will: boolean): number => {
		if (will) {
			throw e
		}

		return 10
	}

	t.is(returnError(() => throwy(true)), e)
	t.is(returnError(() => throwy(false)), 10)
})

test('addBuiltinsToObject', t => {
	const o: LooseObject = {}

	addBuiltinsToObject(o)

	t.is(typeof o.path.join, 'function')

	// Make sure the added properties are overridable
	o.path = 0
	t.is(o.path, 0)
})

test('packageJson', t => {
	t.is(typeof packageJson.name, 'string')
})
