import { describe, expect, it } from 'vitest';
import { SKIP_MS, shouldPrompt, skipActive } from './prefs';

describe('delete prompt', () => {
	const now = 1_000_000;
	it('asks by default', () => {
		expect(shouldPrompt({ skipUntil: null, neverAsk: false }, now)).toBe(true);
	});
	it('stays quiet for 12 hours after "don\'t ask"', () => {
		const skipUntil = now + SKIP_MS;
		expect(shouldPrompt({ skipUntil, neverAsk: false }, now + SKIP_MS - 1)).toBe(false);
		expect(shouldPrompt({ skipUntil, neverAsk: false }, now + SKIP_MS)).toBe(true); // switched itself off
		expect(skipActive(skipUntil, now)).toBe(true);
		expect(skipActive(skipUntil, now + SKIP_MS)).toBe(false);
		expect(skipActive(null, now)).toBe(false);
	});
	it('never asks once permanently turned off', () => {
		expect(shouldPrompt({ skipUntil: null, neverAsk: true }, now)).toBe(false);
	});
});
