import { describe, expect, it } from 'vitest';
import { lineStarts, renderMarkdown } from './render';

const srcOf = (html: string, text: string) => {
	const m = /data-src="(\d+):(\d+)"/.exec(html);
	return m ? text.slice(+m[1], +m[2]) : null;
};
const taskOffsets = (html: string) => [...html.matchAll(/data-task="(\d+)"/g)].map((m) => +m[1]);

describe('lineStarts', () => {
	it('lists where each line begins', () => {
		expect(lineStarts('ab\nc\n')).toEqual([0, 3, 5]);
	});
});

describe('tables', () => {
	const table = '| a | b |\n| - | - |\n| 1 | 2 |';
	const text = `intro\n\n${table}\n\nafter`;

	it('points data-src at exactly the table text', () => {
		expect(srcOf(renderMarkdown(text), text)).toBe(table);
	});

	it('works for a table at the very end with no newline', () => {
		expect(srcOf(renderMarkdown(table), table)).toBe(table);
	});

	it('numbers cells', () => {
		const html = renderMarkdown(table);
		expect(html).toMatch(/<th data-row="0" data-col="1">b<\/th>/);
		expect(html).toMatch(/<td data-row="1" data-col="0">1<\/td>/);
	});

	it('leaves tables inside a quote read-only', () => {
		const html = renderMarkdown('> | a |\n> | - |\n> | 1 |');
		expect(html).toContain('<table');
		expect(html).not.toContain('data-src');
	});

	it('does not treat pipes in a code fence as a table', () => {
		expect(renderMarkdown('```\n| a | b |\n| - | - |\n```')).not.toContain('<table');
	});
});

describe('task lists', () => {
	it('renders boxes with offsets that point between the brackets', () => {
		const text = '- [ ] milk\n- [x] eggs';
		const html = renderMarkdown(text);
		expect(taskOffsets(html).map((o) => text[o])).toEqual([' ', 'x']);
		expect(html).toContain('class="task-item"');
		expect(html).toMatch(/data-task="\d+" checked/);
		expect(html).not.toContain('[ ]');
	});

	it('handles *, numbered, X, and quoted lists', () => {
		const text = '* [ ] a\n\n1. [X] b\n\n> - [ ] c';
		expect(taskOffsets(renderMarkdown(text)).map((o) => text.slice(o - 1, o + 2))).toEqual(['[ ]', '[X]', '[ ]']);
	});

	it('ignores [ ] inside code', () => {
		expect(renderMarkdown('```\n- [ ] no\n```')).not.toContain('data-task');
		expect(renderMarkdown('`- [ ] no`')).not.toContain('data-task');
	});
});

describe('safety and style', () => {
	it('escapes raw HTML', () => {
		const html = renderMarkdown('<script>alert(1)</script>');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('gives # H1 the Persona bar, and only H1', () => {
		expect(renderMarkdown('# Title')).toMatch(/<h1 [^>]*class="display title-bar"/);
		expect(renderMarkdown('## Sub')).not.toContain('title-bar');
	});

	it('opens links in a new window', () => {
		expect(renderMarkdown('[x](https://example.com)')).toContain('target="_blank" rel="noopener noreferrer"');
	});
});

describe('block positions', () => {
	const blocks = (text: string) => [...renderMarkdown(text).matchAll(/data-block="(\d+):(\d+)"/g)].map((m) => text.slice(+m[1], +m[2]));

	it('tags every top-level block with exactly its text', () => {
		const text = '# Title\n\nA paragraph\nwith two lines.\n\n- one\n- two\n\n> quoted\n\n```\ncode\n```\n\n---\n';
		expect(blocks(text)).toEqual(['# Title', 'A paragraph\nwith two lines.', '- one\n- two', '> quoted', '```\ncode\n```', '---']);
	});

	it('treats a loose list as one block without its trailing blank line', () => {
		const text = '- one\n\n- two\n\nafter';
		expect(blocks(text)).toEqual(['- one\n\n- two', 'after']);
	});

	it('does not tag blocks nested in lists or quotes', () => {
		expect(blocks('> para one\n>\n> para two')).toEqual(['> para one\n>\n> para two']);
		expect(blocks('- item\n\n  more of the item')).toEqual(['- item\n\n  more of the item']);
	});

	it('leaves tables to cell editing', () => {
		const html = renderMarkdown('| a |\n| - |\n| 1 |');
		expect(html).toContain('data-src');
		expect(html).not.toContain('data-block');
	});
});
