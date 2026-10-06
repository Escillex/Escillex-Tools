import { describe, expect, it } from 'vitest';
import { toggleTask } from './tasks';

describe('toggleTask', () => {
	it('ticks an open box', () => {
		expect(toggleTask('- [ ] milk', 3)).toBe('- [x] milk');
	});

	it('unticks x and X', () => {
		expect(toggleTask('- [x] milk', 3)).toBe('- [ ] milk');
		expect(toggleTask('- [X] milk', 3)).toBe('- [ ] milk');
	});

	it('works for other list markers and inside a quote', () => {
		expect(toggleTask('* [ ] a', 3)).toBe('* [x] a');
		expect(toggleTask('1. [ ] a', 4)).toBe('1. [x] a');
		expect(toggleTask('> - [ ] a', 5)).toBe('> - [x] a');
	});

	it('only touches its own line', () => {
		expect(toggleTask('- [ ] a\n- [ ] b', 11)).toBe('- [ ] a\n- [x] b');
	});

	it('leaves the text alone when the offset is not on a box', () => {
		expect(toggleTask('- [ ] milk', 0)).toBe('- [ ] milk');
		expect(toggleTask('no box', 2)).toBe('no box');
		expect(toggleTask('- [ ] milk', 99)).toBe('- [ ] milk');
	});
});
