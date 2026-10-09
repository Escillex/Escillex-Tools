import { describe, expect, it } from 'vitest';
import { DEFAULT_TOY_PREFS, TOY_IDS, TOY_LABELS, cleanToyPrefs, isToyId, nextSwitch } from './toys';

describe('toys', () => {
	it('every toy has a label, in loop order', () => {
		expect(TOY_IDS).toEqual(['bubbles', 'keys', 'ratchet', 'switches', 'pen', 'slider']);
		for (const id of TOY_IDS) expect(TOY_LABELS[id]).toBeTruthy();
	});
	it('isToyId', () => {
		expect(isToyId('pen')).toBe(true);
		expect(isToyId('fidget-spinner')).toBe(false);
		expect(isToyId(undefined)).toBe(false);
	});
	it('nextSwitch cycles through all five and wraps', () => {
		expect(nextSwitch('clicky')).toBe('tactile');
		expect(nextSwitch('spacebar')).toBe('clicky');
	});
});

describe('cleanToyPrefs', () => {
	it('nothing saved → defaults', () => {
		expect(cleanToyPrefs(undefined)).toEqual(DEFAULT_TOY_PREFS);
		expect(cleanToyPrefs('junk')).toEqual(DEFAULT_TOY_PREFS);
	});
	it('keeps valid presets', () => {
		const p = { grid: 'large', keys: ['thock', 'thock', 'linear', 'clicky'], detents: 48, switches: 9, notches: 5 };
		expect(cleanToyPrefs(p)).toEqual(p);
	});
	it('a value not on the preset list falls back to its own default only', () => {
		const p = cleanToyPrefs({ grid: 'huge', detents: 30, switches: 6, notches: '10' });
		expect(p.grid).toBe('medium');
		expect(p.detents).toBe(24);
		expect(p.switches).toBe(6);
		expect(p.notches).toBe(10);
	});
	it("keycaps need exactly 4 slots; a bad slot falls back to that slot's default", () => {
		expect(cleanToyPrefs({ keys: ['clicky', 'linear', 'thock'] }).keys).toEqual(DEFAULT_TOY_PREFS.keys);
		expect(cleanToyPrefs({ keys: ['thock', 'nope', 'thock', 'thock'] }).keys).toEqual(['thock', 'tactile', 'thock', 'thock']);
	});
	it('returns a fresh keys array, never the shared default', () => {
		expect(cleanToyPrefs(undefined).keys).not.toBe(DEFAULT_TOY_PREFS.keys);
	});
});
