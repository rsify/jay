import test from 'ava'

import {createPlugger} from '../source/plugger'

const delay = (d: number): Promise<void> =>
	new Promise(resolve => setTimeout(resolve, d))

test('string', async t => {
	const plugger = createPlugger({
		event: 'string'
	})

	plugger.on('event', x => x + 'b')
	plugger.on('event', x => x + 'c')

	t.is(await plugger.dispatch('event', 'a'), 'abc')
})

test('number', async t => {
	const plugger = createPlugger({
		event: 'number'
	})

	plugger.on('event', x => x * 2)
	plugger.on('event', x => x * 2)

	t.is(await plugger.dispatch('event', 2), 8)
})

test('boolean', async t => {
	const plugger = createPlugger({
		event: 'boolean'
	})

	plugger.on('event', x => !x)
	plugger.on('event', x => !x)
	plugger.on('event', x => !x)

	t.is(await plugger.dispatch('event', true), false)
})

test('void', async t => {
	const plugger = createPlugger({
		event: 'void'
	})

	plugger.on('event', () => {})

	t.is(await plugger.dispatch('event', undefined), undefined)
})

test('array', async t => {
	const plugger = createPlugger({
		event: ['string', 'number']
	})

	plugger.on('event', ([s, b]) => [s + 'b', b * 2])
	plugger.on('event', ([s, b]) => [s + 'c', b * 2])

	t.deepEqual(await plugger.dispatch('event', ['a', 2]), ['abc', 8])
})

test('object', async t => {
	const plugger = createPlugger({
		event: {
			a: 'string',
			b: ['number', 'void']
		}
	})

	plugger.on('event', ({a, b: [n]}) => ({
		a: a + 'b',
		b: [n * 2, undefined]
	}))

	plugger.on('event', ({a, b: [n]}) => ({
		a: a + 'c',
		b: [n * 2, undefined]
	}))

	t.deepEqual(await plugger.dispatch('event', {
		a: 'a',
		b: [2, undefined]
	}), {
		a: 'abc',
		b: [8, undefined]
	})
})

test('async listeners', async t => {
	const plugger = createPlugger({
		event: 'string'
	})

	plugger.on('event', async x => {
		await delay(100)
		return x + 'b'
	})

	plugger.on('event', async x => {
		await delay(100)
		return x + 'c'
	})

	t.is(await plugger.dispatch('event', 'a'), 'abc')
})

test('multiple events', async t => {
	const plugger = createPlugger({
		str: 'string',
		num: 'number'
	})

	plugger.on('str', x => x + 'b')
	plugger.on('str', x => x + 'c')
	plugger.on('num', x => x + 2)
	plugger.on('num', x => x + 3)

	t.is(await plugger.dispatch('str', 'a'), 'abc')
	t.is(await plugger.dispatch('num', 1), 6)
})

test('stop', async t => {
	const plugger = createPlugger({
		event: 'string'
	})

	plugger.on('event', x => x + 'b')
	plugger.on('event', (x, stop) => stop(x + 'c'))
	plugger.on('event', x => x + 'd')

	t.is(await plugger.dispatch('event', 'a'), 'abc')
})
