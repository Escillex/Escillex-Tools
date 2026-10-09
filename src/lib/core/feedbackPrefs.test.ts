import { describe, expect, it } from 'vitest';
import { cleanFeedback } from './feedbackPrefs.svelte';

describe('cleanFeedback', () => {
	it('defaults both on', () => {
		expect(cleanFeedback(undefined)).toEqual({ sound: true, haptics: true });
		expect(cleanFeedback('junk')).toEqual({ sound: true, haptics: true });
	});
	it('only a stored false turns one off', () => {
		expect(cleanFeedback({ sound: false })).toEqual({ sound: false, haptics: true });
		expect(cleanFeedback({ sound: 0, haptics: false })).toEqual({ sound: true, haptics: false });
	});
});
