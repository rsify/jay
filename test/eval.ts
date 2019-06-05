import test, {ExecutionContext} from 'ava'

import pSeries from 'p-series'
import * as semver from 'semver'

import {
	EvaluationResults,
	Evaluator,
	PureEvaluator,
	OutputResults,
	createEvaluator
} from '../source/eval'

const out = (output: unknown): OutputResults => ({output})
const err = (error: Error): EvaluationResults => ({error})

test('context globals', t => {
	const {context} = createEvaluator()

	t.is(typeof context.Date, 'function')
	t.is(typeof context.Symbol(), 'symbol')
	t.assert(isNaN(context.NaN))
})

type RunBasicCases =
	(t: ExecutionContext, ev?: Evaluator) =>
	(cases: Array<[string, EvaluationResults]>) =>
	Promise<void>

const runBasicCases: RunBasicCases = (t, ev = createEvaluator().evaluate) => cases =>
	pSeries(cases.map(([input, expected]) => async () =>
		t.deepEqual(await ev(input), expected, input)
	)).then(() => {}) // eslint-disable-line promise/prefer-await-to-then

test('eval - basic', t => runBasicCases(t)([
	['5', out(5)],
	['"hello"', out('hello')],
	['const x = 10', out(undefined)],
	['x', out(10)],
	['{one: 1}', out({one: 1})],
	['throw new Error()', err(new Error())]
]))

test('eval - underscore', t => runBasicCases(t)([
	['_', out(undefined)],
	['5', out(5)],
	['_', out(5)],
	['_', out(5)],
	['const x = 0', out(undefined)],
	['_', out(undefined)]
]))

test('eval - globals', t => runBasicCases(t)([
	['setTimeout', out(setTimeout)],
	['setInterval', out(setInterval)],
	['setImmediate', out(setImmediate)],
	['typeof global', out('object')],
	['typeof Date', out('function')]
]))

test('eval - private global', async t => {
	const ev = createEvaluator().evaluate
	t.not((await ev('global') as OutputResults).output, global)
})

const ctx = {
	a: 10,
	b: 'hello',
	c: Symbol('foo'),
	d: {
		hello: 'world'
	}
}

type RunPureCases =
	(t: ExecutionContext, ev?: PureEvaluator) =>
	(cases: Array<[string, string | undefined]>) =>
	Promise<void>

const runPureCases: RunPureCases = (t, ev = createEvaluator().pureEvaluate) => cases =>
	pSeries(cases.map(([input, expected]) => async () =>
		t.deepEqual(await ev(input), expected, input)
	)).then(() => {}) // eslint-disable-line promise/prefer-await-to-then

if (semver.lt(process.version, '12.3.0')) {
	test.skip('pure', t => t.fail())
} else {
	test('pure', t => runPureCases(t, createEvaluator(ctx).pureEvaluate)([
		['a = 0', undefined], // Side effects - no result
		['100', '100'],
		['a', '10'],
		['b', '"hello"'],
		['Symbol("foo")', 'Symbol(foo)'],
		['undefined', 'undefined'],
		['"str"', '"str"'],
		['10', '10'],
		['1e301', '1e+301'],
		['Infinity', 'Infinity'],
		['-Infinity', '-Infinity'],
		['NaN', 'NaN'],
		['true', 'true'],
		['false', 'false'],
		['Symbol()', 'Symbol()'],
		['() => {}', 'function'],
		['null', 'null'],
		['/50/g', '/50/g'],
		['new Date(0)', '1970-01-01T00:00:00.000Z'],
		['new Set([1, 2, 3])', 'Set { 3 elements }'],
		['new Map([[1, 2], [3, 4]])', 'Map { 2 elements }'],
		['new Error()', 'Error'],
		['new TypeError()', 'TypeError'],
		['new Promise(() => {})', undefined],
		['{}', 'Object'],
		['[]', 'Array(0)'],
		['[1, 2, 3]', 'Array(3)'],
		['[[1], 2, [3, 4, [5]]]', 'Array(3)'],
		['d', 'Object']
	]))
}
