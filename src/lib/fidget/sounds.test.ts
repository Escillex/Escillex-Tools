import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEY_SOUND, RECIPES, play } from './sounds';
import { SWITCH_TYPES } from './toys';
import { setFeedbackGates } from '#lib/ui/feedback.ts';

describe('sound recipes', () => {
	it('stay short and in a sane range', () => {
		for (const r of Object.values(RECIPES)) {
			expect(r.ms).toBeGreaterThan(0);
			expect(r.ms).toBeLessThanOrEqual(120);
			expect(r.gain).toBeGreaterThan(0);
			expect(r.gain).toBeLessThanOrEqual(1);
			expect(r.freq).toBeGreaterThanOrEqual(40);
			expect(r.freq).toBeLessThanOrEqual(8000);
		}
	});
	it('every switch type has its own sound', () => {
		for (const t of SWITCH_TYPES) expect(RECIPES[KEY_SOUND[t]]).toBeDefined();
		expect(new Set(SWITCH_TYPES.map((t) => KEY_SOUND[t])).size).toBe(SWITCH_TYPES.length);
	});
});

describe('play', () => {
	afterEach(() => vi.unstubAllGlobals());
	it('without unlocked audio, still buzzes (and does not throw)', () => {
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });
		setFeedbackGates({ sound: true, haptics: true });
		play('pop', true);
		expect(vibrate).toHaveBeenCalledWith(18);
	});
});
