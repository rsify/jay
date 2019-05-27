declare namespace Emphasize {
	type ClassNames = 'keyword' | 'built_in' | 'type' | 'literal' | 'number' | 'regexp' | 'string' | 'subst' | 'symbol' | 'class' | 'function' | 'title' | 'params' | 'comment' | 'doctag' | 'meta' | 'meta-keyword' | 'meta-string' | 'section' | 'tag' | 'name' | 'builtin-name' | 'attr' | 'attribute' | 'variable' | 'bullet' | 'code' | 'emphasis' | 'strong' | 'formula' | 'link' | 'quote' | 'selector-tag' | 'selector-id' | 'selector-class' | 'selector-attr' | 'selector-pseudo' | 'template-tag' | 'template-variable' | 'addition' | 'deletion'

	type Sheet = {
		[Key in ClassNames]?: any
	}

	function highlight(language: string, input: string, sheet?: Sheet): {
		value: string
	}
}

declare module 'emphasize' {
	export = Emphasize
}
