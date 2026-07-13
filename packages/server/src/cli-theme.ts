import type { EditorTheme, MarkdownTheme, SelectListTheme } from "@earendil-works/pi-tui";

function ansi(code: number, text: string): string {
	return process.stdout.isTTY && !process.env.NO_COLOR ? `\u001b[${code}m${text}\u001b[0m` : text;
}

export const colors = {
	bold: (text: string) => ansi(1, text),
	dim: (text: string) => ansi(2, text),
	cyan: (text: string) => ansi(36, text),
	green: (text: string) => ansi(32, text),
	red: (text: string) => ansi(31, text),
	yellow: (text: string) => ansi(33, text),
};

const selectList: SelectListTheme = {
	selectedPrefix: colors.cyan,
	selectedText: colors.bold,
	description: colors.dim,
	scrollInfo: colors.dim,
	noMatch: colors.dim,
};

export const editorTheme: EditorTheme = {
	borderColor: colors.cyan,
	selectList,
};

export const markdownTheme: MarkdownTheme = {
	heading: colors.bold,
	link: colors.cyan,
	linkUrl: colors.dim,
	code: colors.yellow,
	codeBlock: colors.green,
	codeBlockBorder: colors.dim,
	quote: colors.dim,
	quoteBorder: colors.dim,
	hr: colors.dim,
	listBullet: colors.cyan,
	bold: colors.bold,
	italic: (text) => ansi(3, text),
	strikethrough: (text) => ansi(9, text),
	underline: (text) => ansi(4, text),
};
