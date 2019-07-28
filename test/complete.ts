import test, {ExecutionContext} from 'ava'

import complete, {
	Completions,
	getAllPropertyNames
} from '../source/complete'

import {
	createContext,
	runtime
} from '../source/inspector'

const objectPrototypePropertyNames =
	Object.getOwnPropertyNames(Object.getPrototypeOf({}))

test('getAllPropertyNames', t => {
	const o = {
		x: 0,
		y: 0
	}

	const res = getAllPropertyNames(o)
	t.deepEqual(res, [
		['x', 'y'],
		objectPrototypePropertyNames
	])

	t.true(res[1].length > 2)
	t.true(res[1].includes('valueOf'))
})

test('complete - input', async t => {
	const err = await t.throwsAsync(() => complete({}, 1, '', 0))
	err.message.startsWith('Expected `context` to be vm.Context')
})

test('complete - global lexical scope names', async t => {
	const {context, contextIdPromise} = createContext({})
	const contextId = await contextIdPromise

	await runtime.evaluate({
		contextId,
		expression: 'const hello = 0'
	})

	t.deepEqual(await complete(
		context, contextId, 'hel', 3
	), {
		completions: [['hello']],
		completee: 'hel'
	})
})

test('complete - global lexical scope names - function', async t => {
	const {context, contextIdPromise} = createContext({})
	const contextId = await contextIdPromise

	await runtime.evaluate({
		contextId,
		expression: 'function hello () {}'
	})

	t.deepEqual(await complete(
		context, contextId, 'hel', 3
	), {
		completions: [['hello']],
		completee: 'hel'
	})
})

const C = '/--cursor--/'

const completeMacro = async (
	t: ExecutionContext,
	contextObject: object,
	input: string,
	completee: string | undefined,
	completions: Completions
): Promise<void> => { // eslint-disable-line max-params
	const {context, contextIdPromise} = createContext(contextObject)

	t.deepEqual(await complete(
		context,
		await contextIdPromise,
		input.replace(C, ''),
		input.includes(C) ? input.indexOf(C) : input.length
	), {
		completions,
		...completee === undefined ? {} : {completee}
	})
}

test('complete - nothing', completeMacro, {}, '', undefined, [[]])

test('complete - reference error',
	completeMacro, {}, 'hello.world', 'hello.world', [])

test('complete - empty line', completeMacro, {x: 0}, '', undefined, [
	['x']
])

test('complete - filtered object', completeMacro, {
	one: {},
	two: {},
	three: {}
}, 't', 't', [
	['two', 'three'],
	['toString', 'toLocaleString']
])

test('complete - filtered object, exact', completeMacro, {
	h: {},
	hello: {},
	he: {}
}, 'he', 'he', [
	['he', 'hello']
])

test('complete - missing object, nested',
	completeMacro, {}, 'x.y.z', 'x.y.z', [])

test('complete - object property', completeMacro, {
	x: {
		one: 1
	}
}, 'x.', '', [
	['one'],
	objectPrototypePropertyNames
])

test('complete - filtered object property', completeMacro, {
	x: {
		one: 1,
		two: 2,
		three: 3
	}
}, 'x.t', 't', [
	['two', 'three'],
	['toString', 'toLocaleString']
])

test('complete - filtered object property, exact', completeMacro, {
	x: {
		hihi: 1,
		hi: 2,
		hello: 3
	}
}, 'x.hi', 'hi', [
	['hi', 'hihi']
])

test('complete - nested object property', completeMacro, {
	x: {
		y: {
			one: 1,
			two: 2,
			three: 3
		}
	}
}, 'x.y.t', 't', [
	['two', 'three'],
	['toString', 'toLocaleString']
])

test('complete - null', completeMacro, {}, 'null.', '', [])

test('complete - string primitive properties', completeMacro, {
	x: 'hi'
}, 'x.', '', [
	Object.getOwnPropertyNames('hi'),
	Object.getOwnPropertyNames(Object.getPrototypeOf('hi')),
	Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf('hi')))
])

test('complete - number primitive properties', completeMacro, {
	x: 0
}, 'x.', '', [
	Object.getOwnPropertyNames(0),
	Object.getOwnPropertyNames(Object.getPrototypeOf(0)),
	Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(0)))
])

test('complete - boolean primitive properties', completeMacro, {
	x: true
}, 'x.', '', [
	Object.getOwnPropertyNames(true),
	Object.getOwnPropertyNames(Object.getPrototypeOf(true)),
	Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(true)))
])

test('complete - symbol primitive properties', completeMacro, {
	x: Symbol('s')
}, 'x.', '', [
	Object.getOwnPropertyNames(Symbol('s')),
	Object.getOwnPropertyNames(Object.getPrototypeOf(Symbol('s'))),
	Object.getOwnPropertyNames(Object.getPrototypeOf(Object.getPrototypeOf(Symbol('s'))))
])

test('complete - cursor inside of a function call', completeMacro, {
	hello: {
		world: 0
	}
}, `console.log(hello.wo${C})`, 'wo', [
	['world']
])

test('complete - cursor inside of an object literal', completeMacro, {
	hello: {
		world: 0
	}
}, `JSON.stringify({x: hello.wo${C}})`, 'wo', [
	['world']
])

test('complete - cursor inside of a string literal', completeMacro, {
	hello: {
		world: 0
	}
}, '\'hello.wo\'', '', [])
