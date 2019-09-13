// This is the one and only jay's configuration file, aka the
// place where you load plugins.

module.exports = jay => {
	// Example plugin:
	jay.on('line', line => {
		if (line === '.exit') {
			process.exit(0)
		}

		return line
	})

	// Try uncommenting the above lines, and entering `'cats are
	// ugly'` into a new jay instance - you should see a
	// non-blasphemic version of the sentence.

	// ================================================
	//                 Built-in plugins
	// ================================================

	// You can disable any of the built-in plugins by simply
	// commenting out the line where they're required.

	// =========
	// Rendering

	// Highlight input
	require('jay-repl/dist/plugin/highlight')(jay)

	// Prepend a simple prompt
	require('jay-repl/dist/plugin/prompt')(jay, {
		prompt: '> '
	})

	// ============
	// Key handling

	// Add/remove pair characters, e.g. entering `"` outputs
	// `"|"` where `|` is the position of the cursor. Pressing
	// backspace removes the whole pair.
	require('jay-repl/dist/plugin/pairs')(jay, [
		['\'', '\''],
		['"', '"'],
		['`', '`'],
		['(', ')'],
		['{', '}'],
		['[', ']']
	])

	// Built-in keybindings
	require('jay-repl/dist/plugin/bindings')(jay)

	// ==========
	// Evaluation

	// Support top level await
	require('jay-repl/dist/plugin/wrap-await')(jay)

	// Process npm-required packages
	require('jay-repl/dist/plugin/smart-require')(jay)

	// Evaluate input
	require('jay-repl/dist/plugin/evaluate')(jay, {
		eagerEval: true,
		underscore: true,
		globals: true
	})

	// Startup
	// =======

	// Show node & jay versions on startup
	require('jay-repl/dist/plugin/hello')(jay)

	// Display help information on startup and define jay.help()
	require('jay-repl/dist/plugin/help')(jay)
}
