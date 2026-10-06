import { describe, expect, it } from 'vitest';
import { applyChange, code, cycleHeading, insertLink, insertTable, prefixLines, wrap, type Change, type Sel } from './transforms';

/** Apply a change and return the text with the new selection marked as [..]. */
function run(text: string, sel: Sel, fn: (t: string, s: Sel) => Change): string {
	const c = fn(text, sel);
	const out = applyChange(text, c);
	return out.slice(0, c.sel.start) + '[' + out.slice(c.sel.start, c.sel.end) + ']' + out.slice(c.sel.end);
}

describe('wrap', () => {
	it('wraps the selection and keeps it selected', () => {
		expect(run('a word b', { start: 2, end: 6 }, (t, s) => wrap(t, s, '**'))).toBe('a **[word]** b');
	});

	it('unwraps when already wrapped', () => {
		expect(run('a **word** b', { start: 4, end: 8 }, (t, s) => wrap(t, s, '**'))).toBe('a [word] b');
	});

	it('puts the caret between the marks on an empty selection', () => {
		expect(run('ab', { start: 1, end: 1 }, (t, s) => wrap(t, s, '*'))).toBe('a*[]*b');
	});
});

describe('prefixLines', () => {
	it('prefixes every selected line', () => {
		expect(applyChange('one\ntwo\nthree', prefixLines('one\ntwo\nthree', { start: 1, end: 5 }, '- '))).toBe('- one\n- two\nthree');
	});

	it('removes the prefix when every line has it', () => {
		const t = '- one\n- two';
		expect(applyChange(t, prefixLines(t, { start: 0, end: t.length }, '- '))).toBe('one\ntwo');
	});

	it('moves the caret with the prefix on a single line', () => {
		expect(run('milk', { start: 2, end: 2 }, (t, s) => prefixLines(t, s, '- [ ] '))).toBe('- [ ] mi[]lk');
	});
});

describe('cycleHeading', () => {
	it('goes none → # → ## → ### → none', () => {
		let t = 'Title';
		const step = () => (t = applyChange(t, cycleHeading(t, { start: 0, end: 0 })));
		expect(step()).toBe('# Title');
		expect(step()).toBe('## Title');
		expect(step()).toBe('### Title');
		expect(step()).toBe('Title');
	});

	it('acts on the caret line only', () => {
		expect(applyChange('a\nb', cycleHeading('a\nb', { start: 2, end: 2 }))).toBe('a\n# b');
	});
});

describe('insertLink', () => {
	it('uses the selection as text and selects the url', () => {
		expect(run('see docs', { start: 4, end: 8 }, insertLink)).toBe('see [docs]([url])');
	});

	it('uses placeholder text on an empty selection', () => {
		expect(run('', { start: 0, end: 0 }, insertLink)).toBe('[text]([url])');
	});
});

describe('code', () => {
	it('wraps inline code on one line', () => {
		expect(run('a b', { start: 2, end: 3 }, code)).toBe('a `[b]`');
	});

	it('fences a multi-line selection', () => {
		expect(applyChange('x\ny', code('x\ny', { start: 0, end: 3 }))).toBe('```\nx\ny\n```');
	});
});

describe('insertTable', () => {
	it('inserts an aligned empty table after the caret line, set off by blank lines', () => {
		const out = applyChange('intro\nmore', insertTable('intro\nmore', { start: 2, end: 2 }, 1, 2));
		expect(out).toBe('intro\n\n| Col 1 | Col 2 |\n| ----- | ----- |\n|       |       |\n\nmore');
	});

	it('inserts at the start of an empty document without leading blank lines', () => {
		expect(applyChange('', insertTable('', { start: 0, end: 0 }, 1, 1))).toBe('| Col 1 |\n| ----- |\n|       |\n');
	});
});
