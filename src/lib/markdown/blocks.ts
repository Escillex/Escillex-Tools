/**
 * Write mode edits one top-level block at a time. Replacing it touches
 * only that block's text and the blank lines around it (always exactly
 * one blank line between blocks), so the rest of the file stays as it was.
 */

/** Blank lines at the start of the text after a block. */
const LEADING_BLANK = /^(?:[ \t]*\n)+/;
/** The newline ending the block before, and any blank lines after it. */
const TRAILING_BLANK = /(?:\n[ \t]*)+$/;

export function replaceBlock(text: string, start: number, end: number, next: string): string {
	// The box may leave blank lines or spaces at its edges; the first line's own indentation stays.
	const body = next.replace(LEADING_BLANK, '').trimEnd();
	const before = text.slice(0, start).replace(TRAILING_BLANK, '');
	const after = text.slice(end).replace(LEADING_BLANK, '').replace(/^\n/, '');
	const joined = [before, body, after].filter((part) => part !== '').join('\n\n');
	// `after` carries the file's final newline; when nothing follows, put it back (an empty file gets one too).
	const finalNewline = after === '' && joined !== '' && (text.endsWith('\n') || text === '');
	return finalNewline ? joined + '\n' : joined;
}

/** Add a block after the last one. */
export function appendBlock(text: string, next: string): string {
	if (next.trim() === '') return text;
	return replaceBlock(text, text.length, text.length, next);
}
