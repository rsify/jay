import {
	PassThrough
} from 'stream'

import {
	Interface as ReadLineInterface,
	ReadLineOptions
} from 'readline'

import {LooseObject} from './util'

import {
	Plugger
} from './plugger'

export type Commands = {
	Line: string
	Exit: void
	Abort: void
}

export type PromptResultsMap = {
	[Key in keyof Commands]: [Key, Commands[Key]]
}

export type PromptResults = PromptResultsMap[keyof PromptResultsMap]

// Need to extend the typings for `readline`, as some needed
// properties haven't been types in the standard typings
export type _ReadLineInterface = ReadLineInterface & {
	readonly cursor: number
	readonly line: string
	history: string[]
}

export type _ReadLineOptions = ReadLineOptions & {
	escapeCodeTimeout: number
}

export type DefaultPluggerTypes = {
	line: 'string'
	render: ['string', 'number']
	keypress: {
		sequence: 'string'
		name: 'string'
		ctrl: 'boolean'
		meta: 'boolean'
		shift: 'boolean'
	}
}

export type Prompt = {
	readline: _ReadLineInterface
	readlineInputStream: PassThrough
	resolve: (results: PromptResults) => void
	resultsPromise: Promise<PromptResults>
	rerender(): Promise<void>
	setRawMode(b: boolean): void
	stop(): Promise<void>
}

export type Jay = {
	stdout: NodeJS.WriteStream
	stdin: NodeJS.ReadStream
	plugger: Plugger<DefaultPluggerTypes>
	on: Plugger<DefaultPluggerTypes>['on']
	context: LooseObject
	contextId: number
	prompt: Prompt
}
