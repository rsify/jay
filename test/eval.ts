import test, {ExecutionContext} from 'ava'

import pSeries from 'p-series'

import {
	EvaluationResults,
	Evaluator,
	OutputResults,
	SideEffectError,
	createEvaluator
} from '../src/eval'

const out = (output: any): OutputResults => ({output})
const err = (error: Error): EvaluationResults => ({error})

test('context globals', t => {
	const {context} = createEvaluator()

	t.is(typeof context.Date, 'function')
	t.is(typeof context.Symbol(), 'symbol')
	t.assert(isNaN(context.NaN))
})

type RunCases =
	(t: ExecutionContext, ev?: Evaluator) =>
	(cases: [string, EvaluationResults][]) =>
	Promise<void>

const runCases: RunCases = (t, ev = createEvaluator().evaluate) => cases =>
	pSeries(cases.map(([input, expected]) => async () =>
		t.deepEqual(await ev(input), expected, input)
	)).then(() => {})

test('eval - basic', t => runCases(t)([
	['5', out(5)],
	['"hello"', out('hello')],
	['const x = 10', out(undefined)],
	['x', out(10)],
	['{one: 1}', out({one: 1})]
]))

test('eval - underscore', t => runCases(t)([
	['_', out(undefined)],
	['5', out(5)],
	['_', out(5)],
	['_', out(5)],
	['const x = 0', out(undefined)],
	['_', out(undefined)]
]))

test('eval - globals', t => runCases(t)([
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

const sideEffectErr =
	new SideEffectError('Possible side-effect during evaluation')

const ctx = {
	a: 10,
	b: 'hello',
	c: Symbol('foo')
}

test.skip('pure', t => runCases(t, createEvaluator(ctx).pureEvaluate)([
	['a = 0', err(sideEffectErr)],
	['100', out(100)],
	['a', out(10)],
	['b', out('hello')],
	['c', out(Symbol('foo'))]
]))
