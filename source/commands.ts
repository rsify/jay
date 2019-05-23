export enum Commands {
	Line,
	Exit,
	Abort
}

export interface LineResult {
	line: string
}

export type CommandResult = LineResult | {}

export type PromptResult = [Commands, CommandResult]
