/**
 * What each toolbar button does to the raw text. Every transform returns
 * one Change (a range to replace plus the new selection) instead of new
 * text, so the editor can apply it with execCommand('insertText') and
 * Ctrl+Z still works.
 */
import { serializeTable } from './table';

export interface Sel {
	start: number;
	end: number;
}

export interface Change {
	from: number;
	to: number;
	insert: string;
	sel: Sel;
}

export const applyChange = (text: string, c: Change) => text.slice(0, c.from) + c.insert + text.slice(c.to);

const lineStart = (text: string, i: number) => text.lastIndexOf('\n', i - 1) + 1;
function lineEnd(text: string, i: number) {
	const n = text.indexOf('\n', i);
	return n === -1 ? text.length : n;
}

/** Surround the selection with a mark (`**`, `*`, `` ` ``), or remove it if it's already there. */
export function wrap(text: string, sel: Sel, mark: string): Change {
	const m = mark.length;
	const inner = text.slice(sel.start, sel.end);
	if (text.slice(sel.start - m, sel.start) === mark && text.slice(sel.end, sel.end + m) === mark) {
		return { from: sel.start - m, to: sel.end + m, insert: inner, sel: { start: sel.start - m, end: sel.end - m } };
	}
	return { from: sel.start, to: sel.end, insert: mark + inner + mark, sel: { start: sel.start + m, end: sel.end + m } };
}

/** Start every selected line with a prefix (`- `, `- [ ] `), or remove it if every line has it. */
export function prefixLines(text: string, sel: Sel, prefix: string): Change {
	const from = lineStart(text, sel.start);
	const to = lineEnd(text, sel.end);
	const lines = text.slice(from, to).split('\n');
	const remove = lines.every((l) => l.startsWith(prefix));
	const insert = lines.map((l) => (remove ? l.slice(prefix.length) : prefix + l)).join('\n');
	if (lines.length === 1 && sel.start === sel.end) {
		const caret = Math.max(from, sel.start + (remove ? -prefix.length : prefix.length));
		return { from, to, insert, sel: { start: caret, end: caret } };
	}
	return { from, to, insert, sel: { start: from, end: from + insert.length } };
}

export function cycleHeading(text: string, sel: Sel): Change {
	const from = lineStart(text, sel.start);
	const old = /^#{1,6} /.exec(text.slice(from, lineEnd(text, from)))?.[0] ?? '';
	const level = old.length - 1; // '## ' → 2, '' → -1
	const next = level < 0 ? '# ' : level < 3 ? '#'.repeat(level + 1) + ' ' : '';
	const shift = next.length - old.length;
	return {
		from,
		to: from + old.length,
		insert: next,
		sel: { start: Math.max(from, sel.start + shift), end: Math.max(from, sel.end + shift) }
	};
}

export function insertLink(text: string, sel: Sel): Change {
	const label = text.slice(sel.start, sel.end) || 'text';
	const insert = `[${label}](url)`;
	const urlAt = sel.start + label.length + 3;
	return { from: sel.start, to: sel.end, insert, sel: { start: urlAt, end: urlAt + 3 } };
}

export function code(text: string, sel: Sel): Change {
	const inner = text.slice(sel.start, sel.end);
	if (!inner.includes('\n')) return wrap(text, sel, '`');
	const insert = '```\n' + inner + '\n```';
	return { from: sel.start, to: sel.end, insert, sel: { start: sel.start + 4, end: sel.start + 4 + inner.length } };
}

/** An empty table after the caret's line, with blank lines around it so Markdown sees it as its own block. */
export function insertTable(text: string, sel: Sel, rows: number, cols: number): Change {
	const at = lineEnd(text, sel.end);
	const table = serializeTable({
		head: Array.from({ length: cols }, (_, i) => `Col ${i + 1}`),
		align: Array.from({ length: cols }, () => null),
		rows: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
	});
	const before = at === 0 ? '' : '\n\n';
	// Mid-text, this newline plus the line's own one leaves a blank line after the table.
	const insert = before + table + '\n';
	// Select the first header cell so the user can type over it.
	const first = at + before.length + 2;
	return { from: at, to: at, insert, sel: { start: first, end: first + 5 } };
}
