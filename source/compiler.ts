import {readFileSync} from 'fs'

import ts from 'typescript'

const cwd = process.cwd()

const EVAL_FILE = '[eval].js'

const defaultCompilerOptions: ts.CompilerOptions = {
	allowJs: true,
	checkJs: true,
	lib: ['lib.esnext.d.ts']
}

export type UndoFunction = () => void
export type CompletionFunction =
	(line: string, cursor: number) => ts.CompletionEntry[]

interface Compiler {
	complete: CompletionFunction
	sourceUpdate(source: string): UndoFunction
	sourceAppendLine(line: string): UndoFunction
}

// Creates a compiler that will incrementally compile input, so in the repl's
// case only the last line will be compiled, at least in theory.

export function createCompiler(): Compiler {
	const instance = {
		source: '',
		version: 0
	}

	const serviceHost: ts.LanguageServiceHost = {
		getCompilationSettings: () => defaultCompilerOptions,
		getScriptFileNames: () => [EVAL_FILE],
		getScriptVersion: fileName => {
			return fileName === EVAL_FILE ? instance.version.toString() : '1'
		},
		getScriptSnapshot: fileName => {
			// Optimization: Use a memory cache like ts-node does to prevent
			// reading from disk too much:
			// https://github.com/TypeStrong/ts-node/blob/master/src/index.ts
			try {
				const text = fileName === EVAL_FILE ?
					instance.source :
					readFileSync(fileName).toString()
				return ts.ScriptSnapshot.fromString(text)
			} catch {
				return undefined
			}
		},
		getCurrentDirectory: () => cwd,
		getDirectories: ts.sys.getDirectories,
		directoryExists: ts.sys.directoryExists,
		fileExists: ts.sys.fileExists,
		readFile: ts.sys.readFile,
		readDirectory: ts.sys.readDirectory,
		getDefaultLibFileName: options => ts.getDefaultLibFilePath(options)
	}

	const service = ts.createLanguageService(serviceHost)

	function sourceUpdate(source: string): () => void {
		const oldSource = instance.source
		instance.source = source
		instance.version++

		// Return an undo function
		return () => {
			instance.source = oldSource
		}
	}

	function sourceAppendLine(line: string): () => void {
		return sourceUpdate(instance.source + '\n' + line)
	}

	function complete(line: string, cursor: number): ts.CompletionEntry[] {
		// Insert the potentially incomplete line into source, allowing
		// typescript's service to yield autocompletions for it

		const undo = sourceAppendLine(line)

		const lastNewLineApartFromTheOneThatWasJustAdded =
			instance.source.lastIndexOf('\n', instance.source.length - 2)

		const completions = service.getCompletionsAtPosition(
			EVAL_FILE,
			lastNewLineApartFromTheOneThatWasJustAdded + 1 + cursor,
			undefined
		)

		// Always revert back
		undo()

		return completions === undefined ? [] : completions.entries
	}

	return {complete, sourceUpdate, sourceAppendLine}
}
