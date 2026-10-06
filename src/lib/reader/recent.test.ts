import { describe, expect, it } from 'vitest';
import { MAX_RECENT, previewOf, touch } from './recent';

describe('previewOf', () => {
	it('turns Markdown into plain lines', () => {
		const md = '# Title\n\nSome **bold** and [a link](http://x).\n- [ ] task one\n> a quote';
		expect(previewOf(md)).toBe('Title\nSome bold and a link.\ntask one\na quote');
	});

	it('keeps at most four lines', () => {
		expect(previewOf('a\nb\nc\nd\ne').split('\n')).toEqual(['a', 'b', 'c', 'd']);
	});

	it('drops code fences, rules and table delimiter rows, and joins table cells', () => {
		expect(previewOf('```js\nlet x = 1\n```\n---\n| a | b |\n| - | - |')).toBe('let x = 1\na · b');
	});

	it('shortens very long lines', () => {
		const line = previewOf('x'.repeat(300));
		expect([...line].length).toBeLessThanOrEqual(121);
		expect(line.endsWith('…')).toBe(true);
	});

	it('is empty for an empty file', () => {
		expect(previewOf('\n\n')).toBe('');
	});
});

const r = (id: string, openedAt: number) => ({ id, openedAt });

describe('touch', () => {
	it('puts the new entry first', () => {
		const { keep, drop } = touch([r('a', 2), r('b', 1)], r('c', 3), [false, false]);
		expect(keep.map((x) => x.id)).toEqual(['c', 'a', 'b']);
		expect(drop).toEqual([]);
	});

	it('replaces the same file instead of listing it twice', () => {
		const { keep, drop } = touch([r('a', 2), r('b', 1)], r('b2', 3), [false, true]);
		expect(keep.map((x) => x.id)).toEqual(['b2', 'a']);
		expect(drop.map((x) => x.id)).toEqual(['b']);
	});

	it('keeps the newest ten', () => {
		const list = Array.from({ length: MAX_RECENT }, (_, i) => r(`f${i}`, 100 - i));
		const { keep, drop } = touch(list, r('new', 200), list.map(() => false));
		expect(keep).toHaveLength(MAX_RECENT);
		expect(keep[0].id).toBe('new');
		expect(drop.map((x) => x.id)).toEqual([`f${MAX_RECENT - 1}`]);
	});

	it('sorts an unsorted list', () => {
		expect(touch([r('old', 1), r('mid', 5)], r('new', 9), [false, false]).keep.map((x) => x.id)).toEqual(['new', 'mid', 'old']);
	});
});
