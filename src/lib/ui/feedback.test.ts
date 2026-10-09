import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buzz, setFeedbackGates, tick } from './feedback';

describe('feedback gates', () => {
	let vibrate: ReturnType<typeof vi.fn>;
	let now = 0;
	beforeEach(() => {
		vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });
		// Each tick is 100ms after the last, so the 28ms rate limit never swallows one.
		vi.spyOn(performance, 'now').mockImplementation(() => (now += 100));
		setFeedbackGates({ sound: true, haptics: true });
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('buzzes by default', () => {
		tick();
		expect(vibrate).toHaveBeenCalledWith(8);
	});
	it('Haptics off: neither tick nor buzz vibrates', () => {
		setFeedbackGates({ sound: true, haptics: false });
		tick();
		buzz(true);
		expect(vibrate).not.toHaveBeenCalled();
	});
	it('buzz is rate-limited, so a fast fling is taps, not one long buzz', () => {
		// Hold the shared clock still and move it by hand (it only ever goes forward, like the real one).
		now += 1000;
		vi.spyOn(performance, 'now').mockImplementation(() => now);
		buzz();
		now += 10;
		buzz();
		expect(vibrate).toHaveBeenCalledTimes(1);
		now += 100;
		buzz();
		expect(vibrate).toHaveBeenCalledTimes(2);
	});
	it('Sound off still buzzes', () => {
		setFeedbackGates({ sound: false, haptics: true });
		tick(true);
		buzz();
		expect(vibrate).toHaveBeenNthCalledWith(1, 18);
		expect(vibrate).toHaveBeenNthCalledWith(2, 8);
	});
});
