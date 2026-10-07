import { describe, expect, it } from 'vitest';
import { SWIPE_PX, swipeAction } from './gesture';

describe('swipeAction', () => {
	it('up deletes, down downloads', () => {
		expect(swipeAction(-SWIPE_PX)).toBe('delete');
		expect(swipeAction(-200)).toBe('delete');
		expect(swipeAction(SWIPE_PX)).toBe('download');
		expect(swipeAction(200)).toBe('download');
	});
	it('a short wiggle does nothing', () => {
		expect(swipeAction(0)).toBeNull();
		expect(swipeAction(SWIPE_PX - 1)).toBeNull();
		expect(swipeAction(-(SWIPE_PX - 1))).toBeNull();
	});
});
