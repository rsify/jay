import * as path from 'path'

import test from 'ava'

import * as tempy from 'tempy'
import _noop from '@nikersify/noop'

import {
	createModuler,
	findRequired,
	findRequiredErrors,
	isLocalModuleId,
	stripVersion
} from '../source/moduler'

test('findRequired - parse error', t => {
	const code = "require('hello') F"

	t.deepEqual(findRequired(code), {
		errors: [findRequiredErrors.parseError],
		packages: []
	})
})

test('findRequired - no packages', t => {
	const code = "console.log('hello')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: []
	})
})

test('findRequired - invalid input', t => {
	const cases = [
		'require()',
		"require('' + '')",
		'require(0)',
		"require('hello', 'world')"
	]

	cases.forEach(c => t.deepEqual(findRequired(c), {
		errors: [findRequiredErrors.invalidArguments],
		packages: []
	}, c))
})

test('findRequired - invalid argument format', t => {
	const cases = [
		"require('')",
		"require('@')",
		"require('hey@')",
		"require('@2.1.3')",
		"require('hey@2.1.3@google')",
		"require(' hey')",
		"require('hey ')",
		"require('hey @ 2.1.4')",
		"require('hey@ 2.1.3')",
		"require('hey@2.1.4 ')"
	]

	cases.forEach(c => t.deepEqual(findRequired(c), {
		errors: [findRequiredErrors.invalidArgumentFormat],
		packages: []
	}, c))
})

test('findRequired - simple', t => {
	const code = 'const hello = require("hello")'

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: 'hello'
		}]
	})
})

test('findRequired - version', t => {
	const code = "const hello = require('hello@4.2.0')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: 'hello',
			version: '4.2.0'
		}]
	})
})

test('findRequired - scoped', t => {
	const code = "const hello = require('@nikersify/hello')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: '@nikersify/hello'
		}]
	})
})

test('findRequired - scoped & version', t => {
	const code = "const hello = require('@nikersify/hello@4.2.0')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: '@nikersify/hello',
			version: '4.2.0'
		}]
	})
})

test('findRequired - many packages', t => {
	const code = "require('one') + require('two') === 3"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: 'one'
		}, {
			name: 'two'
		}]
	})
})

test('findRequired - skip core packages', t => {
	const code = "require('fs')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: []
	})
})

test('findRequired - ignore path', t => {
	const code = "require('hello/fun')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: 'hello',
			path: '/fun'
		}]
	})
})

test('findRequired - scoped & path', t => {
	const code = "require('@nikersify/hello/fun')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: '@nikersify/hello',
			path: '/fun'
		}]
	})
})

test('findRequired - version & path', t => {
	const code = "require('hello@4.2.0/fun')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: 'hello',
			version: '4.2.0',
			path: '/fun'
		}]
	})
})

test('findRequired - scoped & version & path', t => {
	const code = "require('@nikersify/hello@4.2.0/fun')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: [{
			name: '@nikersify/hello',
			version: '4.2.0',
			path: '/fun'
		}]
	})
})

test('findRequired - ignore local paths', t => {
	const code = "require('./fun')"

	t.deepEqual(findRequired(code), {
		errors: [],
		packages: []
	})
})

test('isLocalModuleId', t => {
	const yes = [
		'.',
		'./',
		'./module',
		'/hello',
		'./yep.js',
		'./morning/howdy.json'
	]

	const no = [
		'hello',
		'@nikersify/hi',
		'hello@4.2.0',
		'@nikersify/hello@4.2.0'
	]

	yes.forEach(c => t.true(isLocalModuleId(c), c))
	no.forEach(c => t.false(isLocalModuleId(c), c))
})

test('stripVersion', t => {
	const cases = [
		['hello@4.2.0', 'hello'],
		['@nikersify/hello@4.2.0', '@nikersify/hello'],
		['hello', 'hello'],
		['@nikersify/hello', '@nikersify/hello']
	]

	cases.forEach(([input, expected]) =>
		t.is(stripVersion(input), expected, input)
	)
})

test('moduler - require fresh', t => {
	const moduler = createModuler(tempy.directory())

	const cwd = process.cwd()
	process.chdir(__dirname)

	type freshFn = () => number

	const req: () => freshFn = () =>
		moduler.require('./fixture/fresh') as freshFn

	t.is(req()(), 1)
	t.is(req()(), 1)
	t.is(req()(), 1)

	process.chdir(cwd)
})

test('moduler - resolve node_modules', t => {
	const moduler = createModuler(tempy.directory())

	t.deepEqual(moduler.resolve('ava'), {
		location: 'node_modules',
		filepath: path.join(
			__dirname,
			'..',
			'node_modules',
			'ava',
			'index.js'
		),
		meta: {
			name: 'ava',
			version: '2.1.0'
		}
	})
})

if (process.argv.includes('--with-npm')) {
	test('moduler', async t => {
		const base = tempy.directory()
		const moduler = createModuler(base)

		const output = await moduler.install('@nikersify/noop')

		if (typeof output === 'undefined') {
			return t.fail()
		}

		t.deepEqual(output.added, [{
			action: 'add',
			name: '@nikersify/noop',
			version: '1.0.0',
			path: path.join(
				base,
				process.platform === 'win32' ? '' : 'lib',
				'node_modules',
				'@nikersify',
				'noop'
			)
		}])

		t.is(typeof output.elapsed, 'number')

		const cwd = process.cwd()

		// Change to some empty directory to prevent unexpected
		// local resolves.
		process.chdir(tempy.directory())

		t.deepEqual(moduler.resolve('@nikersify/noop'), {
			location: 'global cache',
			filepath: path.join(
				base,
				process.platform === 'win32' ? '' : 'lib',
				'node_modules',
				'@nikersify',
				'noop',
				'index.js'
			),
			meta: {
				name: '@nikersify/noop',
				version: '1.0.0'
			}
		})

		// Revert cwd
		process.chdir(cwd)

		const noop = moduler.require('@nikersify/noop') as typeof _noop
		t.is(noop(5), 5)
	})

	test('moduler - info', async t => {
		const base = tempy.directory()
		const moduler = createModuler(base)

		const output = await moduler.info('@nikersify/noop')

		t.deepEqual(output, {
			name: '@nikersify/noop',
			version: '1.0.0',
			maintainers: ['nikersify <nikersify@nikerino.com>'],
			homepage: 'https://github.com/nikersify/noop#readme',
			published: '2019-05-07T12:56:41.282Z',
			description: 'do nothing',
			license: 'MIT',
			dependencies: {}
		})
	})

	test('moduler - info - missing package', async t => {
		const moduler = createModuler(tempy.directory())

		await t.throwsAsync(
			() => moduler.info('@nikersify/404'),
			'`@nikersify/404@latest` was not found on the npm registry.'
		)

		await t.throwsAsync(
			() => moduler.info('@nikersify/404', '0.0.0'),
			'`@nikersify/404@0.0.0` was not found on the npm registry.'
		)
	})
} else {
	/* eslint-disable ava/no-skip-test, ava/no-identical-title */
	test.skip('moduler', t => t.fail())
	test.skip('moduler - info', t => t.fail())
	test.skip('moduler - info - missing package', t => t.fail())
	/* eslint-enable */
}
