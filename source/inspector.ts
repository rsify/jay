import vm from 'vm'
import {Runtime, Session} from 'inspector'

interface ContextResult<T> {
	contextIdPromise: Promise<number>
	context: T
}

const session = new Session()

try {
	session.connect()
} catch (error) {
	if (error.message !== 'Session is already attached') {
		throw error
	}
}

const createProxy = (domain: string): any => new Proxy({} as any, {
	get(_, property) {
		return (args?: object) => {
			if (typeof property !== 'string') {
				throw new TypeError(`Expected string, got ${typeof property}`)
			}

			return new Promise((resolve, reject) => {
				session.post(`${domain}.${property}`, args, (err, res) => {
					if (err) {
						reject(err)
					} else {
						resolve(res)
					}
				})
			})
		}
	}
})

export function createContext<T extends {}>(base: T): ContextResult<T> {
	const contextIdPromise: Promise<number> = new Promise(resolve => {
		// About `Runtime.enable`:
		// https://chromedevtools.github.io/devtools-protocol/v8/Runtime#method-enable

		// We're enabling context creation events before attaching the
		// actual event handler to let the global "context 1" slip by, as
		// we're only interested in the newly created vm context.
		session.post('Runtime.enable')

		session.once('Runtime.executionContextCreated', ({params}) => {
			session.post('Runtime.disable')
			resolve(params.context.id)
		})

		vm.createContext(base)
	})

	return {
		contextIdPromise,
		context: base
	}
}

export const runtime = createProxy('Runtime')
export interface EvaluateReturnType extends Runtime.EvaluateReturnType {}
