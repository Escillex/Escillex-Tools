/**
 * GFM tables as data: parse a table's lines into a grid, change it, and
 * write it back with aligned columns so the raw text stays readable.
 *
 * Cells hold raw Markdown (escapes included), so an untouched cell is
 * written back exactly as it was.
 */
export type Align = 'left' | 'center' | 'right' | null;

export interface Table {
	head: string[];
	align: Align[];
	rows: string[][];
}

/** Split one table line into cells. `\|` is an escaped pipe and stays in its cell. */
export function splitRow(line: string): string[] {
	let s = line.trim();
	if (s.startsWith('|')) s = s.slice(1);
	if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
	const cells: string[] = [];
	let cur = '';
	for (let i = 0; i < s.length; i++) {
		if (s[i] === '\\' && s[i + 1] === '|') {
			cur += '\\|';
			i++;
		} else if (s[i] === '|') {
			cells.push(cur.trim());
			cur = '';
		} else cur += s[i];
	}
	cells.push(cur.trim());
	return cells;
}

const DELIM = /^:?-+:?$/;

function readAlign(cell: string): Align {
	const l = cell.startsWith(':');
	const r = cell.endsWith(':');
	return l && r ? 'center' : l ? 'left' : r ? 'right' : null;
}

/** GFM: every row has exactly as many cells as the header. */
function fit(cells: string[], n: number): string[] {
	return Array.from({ length: n }, (_, i) => cells[i] ?? '');
}

export function parseTable(src: string): Table | null {
	const lines = src.split('\n').filter((l) => l.trim() !== '');
	if (lines.length < 2) return null;
	const head = splitRow(lines[0]);
	const delim = splitRow(lines[1]);
	if (delim.length !== head.length || !delim.every((c) => DELIM.test(c))) return null;
	return {
		head,
		align: delim.map(readAlign),
		rows: lines.slice(2).map((l) => fit(splitRow(l), head.length))
	};
}

/** Width in characters, so an emoji counts once. */
const width = (s: string) => [...s].length;
const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - width(s)));

function delimFor(a: Align, w: number): string {
	if (a === 'center') return ':' + '-'.repeat(w - 2) + ':';
	if (a === 'left') return ':' + '-'.repeat(w - 1);
	if (a === 'right') return '-'.repeat(w - 1) + ':';
	return '-'.repeat(w);
}

export function serializeTable(t: Table): string {
	const widths = t.head.map((h, c) => Math.max(3, width(h), ...t.rows.map((r) => width(r[c]))));
	const line = (cells: string[]) => '| ' + cells.map((cell, c) => pad(cell, widths[c])).join(' | ') + ' |';
	return [line(t.head), line(t.align.map((a, c) => delimFor(a, widths[c]))), ...t.rows.map(line)].join('\n');
}

export function setCell(t: Table, row: number, col: number, value: string): Table {
	if (row === 0) return { ...t, head: t.head.map((h, c) => (c === col ? value : h)) };
	return { ...t, rows: t.rows.map((r, i) => (i === row - 1 ? r.map((v, c) => (c === col ? value : v)) : r)) };
}

export function addRow(t: Table, at: number): Table {
	const i = Math.min(Math.max(at, 1), t.rows.length + 1) - 1;
	const rows = [...t.rows];
	rows.splice(i, 0, t.head.map(() => ''));
	return { ...t, rows };
}

export function removeRow(t: Table, row: number): Table {
	if (row < 1 || row > t.rows.length) return t;
	return { ...t, rows: t.rows.filter((_, i) => i !== row - 1) };
}

const insertAt = <T>(list: T[], at: number, v: T) => [...list.slice(0, at), v, ...list.slice(at)];

export function addColumn(t: Table, at: number): Table {
	const i = Math.min(Math.max(at, 0), t.head.length);
	return {
		head: insertAt(t.head, i, ''),
		align: insertAt<Align>(t.align, i, null),
		rows: t.rows.map((r) => insertAt(r, i, ''))
	};
}

export function removeColumn(t: Table, col: number): Table {
	if (t.head.length <= 1 || col < 0 || col >= t.head.length) return t;
	const drop = <T>(list: T[]) => list.filter((_, i) => i !== col);
	return { head: drop(t.head), align: drop(t.align), rows: t.rows.map(drop) };
}

/** Plain text typed into a cell → Markdown that can't break the table. */
export const escapeCell = (text: string) => text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

/** A cell's Markdown → the text shown while editing it. */
export const unescapeCell = (md: string) => md.replace(/\\\|/g, '|').replace(/<br\s*\/?>/gi, '\n');
