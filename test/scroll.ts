import test from 'ava'

import {flow} from 'lodash'

import {
	ScrollInfo,
	createScroller,
	firstItem,
	generateScrollbar,
	lastItem,
	nextItem,
	previousItem
} from '../source/scroll'

type Omit<T, Key> = Pick<T, Exclude<keyof T, Key>>

test('createScroller', t => {
	t.deepEqual(createScroller(10, 4), {
		start: 0,
		end: 3,
		selected: -1,
		_itemAmount: 10
	})
})

test('createScroller - less items than to show', t => {
	t.deepEqual(createScroller(3, 5), {
		start: 0,
		end: 2,
		selected: -1,
		_itemAmount: 3
	})
})

test('nextItem', t => {
	// [start, end, selected]
	const scenario = [
		[0, 3, -1],
		[0, 3, 0],
		[0, 3, 1],
		[0, 3, 2],
		[1, 4, 3],
		[2, 5, 4],
		[3, 6, 5],
		[4, 7, 6],
		[5, 8, 7],
		[6, 9, 8],
		[6, 9, 9],
		[0, 3, -1],
		[0, 3, 0], // Wrap around
		[0, 3, 1]
	]

	scenario.reduce((scrollInfo, expected) => {
		const [start, end, selected] = expected

		t.deepEqual(scrollInfo, {
			start,
			end,
			selected,
			_itemAmount: 10
		}, expected.join(', '))

		return nextItem(scrollInfo)
	}, createScroller(10, 4))
})

test('previousItem', t => {
	// [start, end, selected]
	const scenario = [
		[6, 9, 9],
		[6, 9, 8],
		[6, 9, 7],
		[5, 8, 6],
		[4, 7, 5],
		[3, 6, 4],
		[2, 5, 3],
		[1, 4, 2],
		[0, 3, 1],
		[0, 3, 0],
		[0, 3, -1],
		[6, 9, 9], // Wrap around
		[6, 9, 8]
	]

	scenario.reduce((scrollInfo, expected) => {
		const [start, end, selected] = expected

		t.deepEqual(scrollInfo, {
			start,
			end,
			selected,
			_itemAmount: 10
		}, scenario.indexOf(expected).toString())

		return previousItem(scrollInfo)
	}, lastItem(createScroller(10, 4)))
})

test('firstItem', t => {
	const f = flow([
		nextItem,
		nextItem,
		nextItem,
		firstItem
	])

	t.deepEqual(f(createScroller(10, 4)), {
		start: 0,
		end: 3,
		selected: 0,
		_itemAmount: 10
	})
})

test('firstItem - not many items', t => {
	const f = flow([
		nextItem,
		nextItem,
		firstItem
	])

	t.deepEqual(f(createScroller(3, 6)), {
		start: 0,
		end: 2,
		selected: 0,
		_itemAmount: 3
	})
})

test('lastItem', t => {
	t.deepEqual(lastItem(createScroller(10, 4)), {
		start: 6,
		end: 9,
		selected: 9,
		_itemAmount: 10
	})

	t.deepEqual(lastItem(createScroller(10, 1)), {
		start: 9,
		end: 9,
		selected: 9,
		_itemAmount: 10
	})
})

test('lastItem - less items than to show', t => {
	t.deepEqual(lastItem(createScroller(3, 6)), {
		start: 0,
		end: 2,
		selected: 2,
		_itemAmount: 3
	})
})

test('generateScrollbar - full scrollbar', t => {
	const s: Omit<ScrollInfo, 'selected'> = {
		start: 0,
		end: 2,
		_itemAmount: 3
	}

	for (let i = 0; i < 3; i++) {
		t.deepEqual(generateScrollbar({
			...s,
			selected: i
		}), {
			size: 3,
			offset: 0
		})
	}
})

test('generateScrollbar - beginning', t => {
	t.deepEqual(generateScrollbar({
		_itemAmount: 10,
		start: 0,
		end: 3,
		selected: 0
	}), {
		size: 2,
		offset: 0
	})
})

test('generateScrollbar - middle', t => {
	t.deepEqual(generateScrollbar({
		_itemAmount: 10,
		start: 4,
		end: 8,
		selected: 5
	}), {
		size: 3,
		offset: 2
	})
})

test('generateScrollbar - end', t => {
	t.deepEqual(generateScrollbar({
		_itemAmount: 11,
		start: 5,
		end: 10,
		selected: 10
	}), {
		size: 4,
		offset: 2
	})
})
