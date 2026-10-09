import { describe, expect, it } from 'vitest';
import { allPopped, isEnd, newSheet, notchAt, turnDelta } from './mechanics';

describe('bubble sheet', () => {
	it('starts unpopped and knows when it is cleared', () => {
		const s = newSheet(4);
		expect(s).toEqual([false, false, false, false]);
		expect(allPopped(s)).toBe(false);
		expect(allPopped([true, true, true, true])).toBe(true);
	});
});

describe('turnDelta', () => {
	it('a quarter turn', () => {
		expect(turnDelta(0, Math.PI / 2)).toBeCloseTo(0.25);
		expect(turnDelta(Math.PI / 2, 0)).toBeCloseTo(-0.25);
	});
	it('crossing the ±180° seam is a small step, not a whole turn', () => {
		expect(turnDelta(3.1, -3.1)).toBeCloseTo((2 * Math.PI - 6.2) / (2 * Math.PI));
		expect(turnDelta(-3.1, 3.1)).toBeCloseTo(-(2 * Math.PI - 6.2) / (2 * Math.PI));
	});
});

describe('slider notches', () => {
	it('snaps a 0..1 position to the nearest of N notches', () => {
		expect(notchAt(0, 10)).toBe(0);
		expect(notchAt(1, 10)).toBe(9);
		expect(notchAt(0.5, 5)).toBe(2);
	});
	it('clamps drags past either end', () => {
		expect(notchAt(-0.4, 10)).toBe(0);
		expect(notchAt(1.7, 10)).toBe(9);
	});
	it('the ends are the first and last notch', () => {
		expect(isEnd(0, 10)).toBe(true);
		expect(isEnd(9, 10)).toBe(true);
		expect(isEnd(4, 10)).toBe(false);
	});
});
