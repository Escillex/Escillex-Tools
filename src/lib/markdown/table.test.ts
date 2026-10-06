import { describe, expect, it } from 'vitest';
import {
	addColumn,
	addRow,
	escapeCell,
	parseTable,
	removeColumn,
	removeRow,
	serializeTable,
	setCell,
	splitRow,
	unescapeCell
} from './table';

const SRC = ['| Item | Cost |', '| ---- | ---: |', '| Rice | 52   |', '| Eggs | 90   |'].join('\n');

describe('splitRow', () => {
	it('splits on pipes and trims', () => {
		expect(splitRow('| a | b |')).toEqual(['a', 'b']);
		expect(splitRow('a|b')).toEqual(['a', 'b']);
	});

	it('keeps escaped pipes inside one cell', () => {
		expect(splitRow('| a \\| b | c |')).toEqual(['a \\| b', 'c']);
	});

	it('keeps a trailing escaped pipe', () => {
		expect(splitRow('| x \\|')).toEqual(['x \\|']);
	});
});

describe('parseTable', () => {
	it('reads head, alignment and rows', () => {
		expect(parseTable(SRC)).toEqual({
			head: ['Item', 'Cost'],
			align: [null, 'right'],
			rows: [
				['Rice', '52'],
				['Eggs', '90']
			]
		});
	});

	it('reads all alignments', () => {
		expect(parseTable('|a|b|c|d|\n|:--|:-:|--:|---|')?.align).toEqual(['left', 'center', 'right', null]);
	});

	it('pads short rows and drops extra cells', () => {
		expect(parseTable('|a|b|\n|-|-|\n|1|\n|1|2|3|')?.rows).toEqual([
			['1', ''],
			['1', '2']
		]);
	});

	it('returns null for something that is not a table', () => {
		expect(parseTable('just text')).toBeNull();
		expect(parseTable('| a |\n| not a delimiter |')).toBeNull();
	});
});

describe('serializeTable', () => {
	it('aligns columns', () => {
		const t = parseTable('|Item|Cost|\n|-|-:|\n|Rice|52|')!;
		expect(serializeTable(t)).toBe(['| Item | Cost |', '| ---- | ---: |', '| Rice | 52   |'].join('\n'));
	});

	it('is byte-identical for an already-aligned table', () => {
		expect(serializeTable(parseTable(SRC)!)).toBe(SRC);
	});

	it('measures width by characters, not UTF-16 units', () => {
		const t = parseTable('|a|\n|-|\n|😀😀😀😀|')!;
		expect(serializeTable(t).split('\n')[1]).toBe('| ---- |');
	});
});

describe('editing', () => {
	it('sets a body cell', () => {
		const t = setCell(parseTable(SRC)!, 2, 1, '95');
		expect(t.rows[1]).toEqual(['Eggs', '95']);
	});

	it('sets a header cell', () => {
		expect(setCell(parseTable(SRC)!, 0, 0, 'Thing').head).toEqual(['Thing', 'Cost']);
	});

	it('round-trips an escaped pipe through an edit', () => {
		const t = setCell(parseTable(SRC)!, 1, 0, escapeCell('A | B'));
		const again = parseTable(serializeTable(t))!;
		expect(again.rows[0]).toEqual(['A \\| B', '52']);
		expect(unescapeCell(again.rows[0][0])).toBe('A | B');
	});

	it('adds and removes rows', () => {
		const t = addRow(parseTable(SRC)!, 2);
		expect(t.rows).toEqual([
			['Rice', '52'],
			['', ''],
			['Eggs', '90']
		]);
		expect(removeRow(t, 2).rows).toEqual([
			['Rice', '52'],
			['Eggs', '90']
		]);
	});

	it('adds a row at the end when at is past the last row', () => {
		expect(addRow(parseTable(SRC)!, 99).rows.at(-1)).toEqual(['', '']);
	});

	it('adds and removes columns', () => {
		const t = addColumn(parseTable(SRC)!, 1);
		expect(t.head).toEqual(['Item', '', 'Cost']);
		expect(t.align).toEqual([null, null, 'right']);
		expect(t.rows[0]).toEqual(['Rice', '', '52']);
		expect(removeColumn(t, 1)).toEqual(parseTable(SRC));
	});

	it('never removes the last column or the header', () => {
		const one = parseTable('|a|\n|-|\n|1|')!;
		expect(removeColumn(one, 0)).toEqual(one);
		expect(removeRow(one, 0)).toEqual(one);
	});
});

describe('escapeCell / unescapeCell', () => {
	it('escapes pipes and line breaks', () => {
		expect(escapeCell('a | b\nc')).toBe('a \\| b<br>c');
		expect(unescapeCell('a \\| b<br>c')).toBe('a | b\nc');
	});
});
