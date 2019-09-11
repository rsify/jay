# Jay [![Build Status](https://travis-ci.com/nikersify/jay.svg?token=c7oPsWTPpETijSnB7xF2&branch=master)](https://travis-ci.com/nikersify/jay) [![npm](https://img.shields.io/npm/v/jay-repl.svg)](https://npmjs.com/package/jay-repl)

> Supercharged JavaScript REPL :sunglasses:

Jay is a terminal-based JavaScript REPL focused on increasing prototyping speed and productivity. It's packed with modern REPL features, whilst also striving to maintain a familiar REPL vibe.

Here are the most important features that differentiate Jay from other REPL's:

- `require` modules directly from the registry
- Eager eval (requires `node >= 12.3.0`)
- Top level `await`
- Typeahead + dropdown menu-style completion

Plus some necessities:

- Colored input
- Bracket/quote pair completion
- Fresh `require`
- Full [readline](https://nodejs.org/api/readline.html) keybindings support
- Lazy loaded built-in modules
- `_` variable


# Why

Jay was created with two goals in mind:
1. To bring modern JavaScript REPL features to the terminal, like eager eval, top level `await` and typeahead code completion
2. To create a super quick environment for prototyping/running npm dependent JavaScript code.

It would probably make sense to split Jay into separate packages (just the REPL into one, and the smart `require` into another) in the future, to allow better reusability of the REPL components.


# Examples

## Basic web scraping

Let's say that for some reason we want to scrape all of the titles and links from the [hacker news](https://news.ycombinator.com) front page.

To accomplish that, we can use Jay (obviously), [got](https://github.com/sindresorhus/got) (http client) and [cheerio](https://cheerio.js.org) (jQuery-esque API for server-side).

Let's begin by running Jay and getting the necessary dependencies:

```bash
$ jay
```

```js
> const got = require('got')
> const cheerio = require('cheerio')
```

Then, we download the page and load the HTML into cheerio:

```js
> const {body} = await got('https://news.ycombinator.com')
> const $ = cheerio.load(body)
```

`$` behaves pretty much like jQuery, we can use the following simple one-liner to get our result:
```js
> $('a.storylink').map((i, el) => ({text: $(el).text(), link: $(el).attr('href')})).get()
```
```js
[
	{
		text: 'National Park Typeface',
		link: 'https://nationalparktypeface.com'
	},
	...
]
```

After running the previous line, we can store the result in a named variable via `_` - which caches the result of the last evaluation - as follows:

```js
> const result = _
> result.length // 30
```

<hr>

If you find an interesting example to put in this section, a PR is more than welcome!


# Install

Jay expects itself to be installed globally:

```sh
$ npm install -g jay-repl
```

Then simply run it by typing `jay` in the terminal:

```sh
$ jay
```

Alternatively, Jay can be directly run with Node builtin `npx`:

```sh
$ npx -p jay-repl jay
```


# FAQ

## How does the smart `require` function work?

After pressing <kbd>enter</kbd> in the prompt, Jay parses the entered input into an AST using [acorn](https://github.com/acornjs/acorn) and looks for all `CallExpression`'s whose names are equal to `require`.

This triggers the "asker" system to ask the user whether they actually want to install a given `require`'d module. If the user decides to install the module, Jay starts a "global" `npm` install in its cache directory. If they don't, nothing happens and the evaluation will most likely result in an "module not found" error.

Either way, after all of the above is complete, the control is handed back to the evaluator which only now actually executes the entered line.

## How does Jay's `require` differ from the normal one?

The normal `require` only looks for modules within two places:
- locally, if the module id is prefixed with things like `.` or `../` - e.g. `require('./index.js')`
- in `node_modules` - e.g. `require('express')`

Jay's `require` in addition to the above also looks within its global cache (but only if the local & `node_modules` resolutions fail). This, in addition to parsing the input and looking for `require` calls, allows for importing any module that's on the registry, automatically installing it if needed.

The `require` also is also a "fresh `require`".

## What does "fresh `require`" mean?

The `require` function in Jay doesn't use the standard node's cache and always reads the files from disk upon importing them. Consider the following example:

Let's say we have a file called `greet.js` with the following contents:

```js
module.exports = x => 'hello '.repeat(x)
```

Start up `node`'s repl, require it, and we get the expected output:
```bash
$ node
```
```js
> greet = require('./greet')
> greet(2)
// 'hello hello '
```

Now, without closing the session, we change the file into:
```diff
-module.exports = x => 'hello '.repeat(x)
+module.exports = x => 'hi '.repeat(x)
```

Requiring the file again will, unfortunately, not change the output:
```js
> greet = require('./greet')
> greet(3)
// 'hello hello hello '
```

Jay, as beforementioned, doesn't cache modules. Repeating the steps yields the result we actually want in this case:
```bash
$ jay
$ echo "module.exports = x => 'hello '.repeat(x) > greet.js"
```
```js
> greet = require('./greet')
> greet(2)
// 'hello hello '
```
```bash
$ sed -i 's/hello/hi/' greet.js
```
```js
// (in the same Jay session)
> greet = require('./greet')
> greet(3)
// 'hi hi hi '
```

This also works analogically with modules in `node_modules`, Jay's cache, JSON files, etc.

## Where does Jay store the cached modules?

Jay uses [env-paths](https://github.com/sindresorhus/env-paths) to determine the cache's location:

- MacOS - `~/Library/Caches/jay-repl-nodejs/packages`
- Linux - `~/.cache/jay-repl-nodejs`
- Windows - `~/`

You can see the exact location of the cache by simply running the following line in Jay:

```js
> require('env-paths')('jay-repl').cache
```


# Contributing

1. Fork & clone the repository
2. Start the Typescript watch script:

```bash
$ npm run build:watch
```

3. Make your changes
4. Try out your changes on your local build

```bash
$ node dist/cli.js
```

5. Run the tests:

```bash
$ npm test
```

6. Commit & PR!

This repository uses Git LFS for storing readme's gifs, if you want to view them locally you will need to install and set up the [Git LFS](https://git-lfs.github.com) extension on your machine.

# License

MIT © [nikersify](https://nikerino.com)
