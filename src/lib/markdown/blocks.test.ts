import { describe, expect, it } from 'vitest';
import { appendBlock, replaceBlock } from './blocks';

const DOC = 'a\n\nb\n\nc';
const B = { start: 3, end: 4 }; // the "b" block

describe('replaceBlock', () => {
	it('replaces only the block', () => {
		expect(replaceBlock(DOC, B.start, B.end, 'B')).toBe('a\n\nB\n\nc');
	});

	it('trims whitespace the editor leaves at the edges', () => {
		expect(replaceBlock(DOC, B.start, B.end, '\nB  \n\n')).toBe('a\n\nB\n\nc');
	});

	it('deletes the block and its blank line when emptied', () => {
		expect(replaceBlock(DOC, B.start, B.end, '')).toBe('a\n\nc');
		expect(replaceBlock(DOC, B.start, B.end, '   \n')).toBe('a\n\nc');
	});

	it('deletes the first or last block cleanly', () => {
		expect(replaceBlock('a\n\nb', 0, 1, '')).toBe('b');
		expect(replaceBlock('a\n\nb\n', 3, 4, '')).toBe('a\n');
	});

	it('lets a blank line split one block into two', () => {
		expect(replaceBlock(DOC, B.start, B.end, 'b1\n\nb2')).toBe('a\n\nb1\n\nb2\n\nc');
	});

	it('leaves exactly one blank line between neighbours', () => {
		expect(replaceBlock('a\n\n\n\nb\n\n\nc', 5, 6, 'B')).toBe('a\n\nB\n\nc');
	});

	it("keeps the file's final newline", () => {
		expect(replaceBlock('a\n\nb\n', 3, 4, 'B')).toBe('a\n\nB\n');
		expect(replaceBlock('a\n\nb', 3, 4, 'B')).toBe('a\n\nB');
	});

	it('keeps the indentation inside the new text', () => {
		expect(replaceBlock(DOC, B.start, B.end, '- x\n  - y')).toBe('a\n\n- x\n  - y\n\nc');
	});
});

describe('appendBlock', () => {
	it('adds a block after the last one', () => {
		expect(appendBlock('a\n', 'new')).toBe('a\n\nnew\n');
		expect(appendBlock('a', 'new')).toBe('a\n\nnew');
	});

	it('starts an empty document with a final newline', () => {
		expect(appendBlock('', 'new')).toBe('new\n');
	});

	it('adds nothing for empty text', () => {
		expect(appendBlock('a\n', '  ')).toBe('a\n');
	});
});
