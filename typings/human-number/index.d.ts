declare module 'human-number' {
	const humanNumber: (x: number, mapper?: (y: number) => string) => string

	export = humanNumber
}
