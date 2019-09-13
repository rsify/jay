const $stop: unique symbol = Symbol('plugger$stop')

type Stopped<T> = {
	[$stop]: true
	value: T
}

export type CPrimitiveMap = {
	'void': void
	'boolean': boolean
	'number': number
	'string': string
}

export type CPrimitives = keyof CPrimitiveMap
export type CPrimitive<T extends CPrimitives> = CPrimitiveMap[T]

export type CArray<T extends CPrimitives[]> = {
	[Index in keyof T]: T[Index] extends CPrimitives ? CPrimitive<T[Index]> : never
}

export type CObject<T> = {
	[Key in keyof T]: CValue<T[Key]>
}

export type CValue<T> = T extends CPrimitives ?
	CPrimitive<T> :
	T extends CPrimitives[] ?
		CArray<T> :
		CObject<T>

function stop<T>(arg: T): Stopped<T> {
	return {
		value: arg,
		[$stop]: true
	}
}

export type CPrimitiveLike = CPrimitives

// 🤮
type A0 = CPrimitives
type A1 = [A0]
type A2 = [A0, A0]
type A3 = [A0, A0, A0]
type A4 = [A0, A0, A0, A0]
type A5 = [A0, A0, A0, A0, A0]
type A6 = [A0, A0, A0, A0, A0, A0]
type A7 = [A0, A0, A0, A0, A0, A0, A0]
type A8 = [A0, A0, A0, A0, A0, A0, A0, A0]
type A9 = [A0, A0, A0, A0, A0, A0, A0, A0, A0]

export type CArrayLike = A1 | A2 | A3 | A4 | A5 | A6 | A7 | A8 | A9

export type CObjectLike = {
	[key: string]: CValueLike
}

export type CValueLike =
	CPrimitiveLike | CArrayLike | CObjectLike

type MaybePromise<T> = T | Promise<T>

type Listener<T extends CValueLike, Key extends keyof T, Input extends CValue<T[Key]> = CValue<T[Key]>> =
	(arg: Input, stopper: typeof stop) => MaybePromise<Input | Stopped<Input>>

type ListenerMeta<T extends CValueLike, Key extends keyof T> = {
	once: boolean
	callback: Listener<T, Key>
}

type EventKey<T> = keyof T

function isStopped<T>(x: unknown | Stopped<T>): x is Stopped<T> {
	return typeof x === 'object' && Object.hasOwnProperty.call(x, $stop)
}

export type Plugger<T extends CValueLike> = {
	dispatch<Key extends EventKey<T>>(
		key: Key,
		arg: CValue<T[Key]>
	): Promise<CValue<T[Key]>>

	on<Key extends EventKey<T>>(
		key: Key,
		callback: Listener<T, Key>
	): void

	one<Key extends EventKey<T>>(
		key: Key,
		callback: Listener<T, Key>
	): void
}

export function createPlugger<T extends CValueLike>(
	_: T
): Plugger<T> {
	const listeners: {
		[Key in EventKey<T>]?: Array<ListenerMeta<T, Key>>
	} = {}

	async function dispatch<Key extends EventKey<T>>(key: Key, arg: CValue<T[Key]>): Promise<CValue<T[Key]>> {
		const list = listeners[key] || []

		if (!list) {
			return arg
		}

		let current = arg

		for (const listener of list.slice()) {
			// eslint-disable-next-line no-await-in-loop
			const val = await listener.callback(current, stop)

			if (isStopped(val)) {
				current = val.value
				break
			}

			current = val

			if (listener.once) {
				list.splice(list.indexOf(listener), 1)
			}
		}

		return current
	}

	const addListener = (once: boolean) =>
		<Key extends EventKey<T>>(
			key: Key,
			callback: Listener<T, Key>
		): void => {
			const list = listeners[key]
			const meta = {once, callback}

			if (list === undefined) {
				listeners[key] = [meta]
			} else {
				list.push(meta)
			}
		}

	const on = addListener(false)
	const one = addListener(true)

	return {
		dispatch,
		on,
		one
	}
}