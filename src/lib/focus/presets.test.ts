import { describe, expect, it } from 'vitest';
import { CLASSIC, cleanPreset, pickPreset, withClassic } from './presets';

describe('cleanPreset', () => {
	it('keeps a valid preset', () => {
		const p = { id: 'a', updatedAt: 1, deleted: false, name: 'Deep', focus: 50, break: 10, long: 20, every: 3 };
		expect(cleanPreset(p)).toEqual(p);
	});
	it('clamps lengths into LIMITS and rounds to whole minutes', () => {
		const p = cleanPreset({ id: 'a', updatedAt: 1, deleted: false, name: 'x', focus: 999, break: 0, long: 7.6, every: 40 })!;
		expect([p.focus, p.break, p.long, p.every]).toEqual([180, 1, 8, 12]);
	});
	it('rejects anything without an id or with non-numeric lengths', () => {
		expect(cleanPreset({ name: 'x' })).toBeNull();
		expect(cleanPreset({ id: 'a', focus: 'lots' })).toBeNull();
		expect(cleanPreset(null)).toBeNull();
	});
	it('falls back to "Preset" for an empty name', () => {
		expect(cleanPreset({ id: 'a', updatedAt: 1, deleted: false, name: '  ', focus: 25, break: 5, long: 15, every: 4 })!.name).toBe('Preset');
	});
});

describe('pickPreset / withClassic', () => {
	const mine = { ...CLASSIC, id: 'm', name: 'Mine', focus: 50 };
	it('finds the saved preset', () => expect(pickPreset([CLASSIC, mine], 'm')).toBe(mine));
	it('falls back to Classic when the id is gone or deleted', () => {
		expect(pickPreset([CLASSIC], 'm')).toBe(CLASSIC);
		expect(pickPreset([{ ...mine, deleted: true }], 'm')).toEqual(CLASSIC);
		expect(pickPreset([], undefined)).toEqual(CLASSIC);
	});
	it('always lists Classic first, once, and drops tombstones', () => {
		expect(withClassic([mine, { ...mine, id: 'd', deleted: true }]).map((p) => p.id)).toEqual(['classic', 'm']);
		expect(withClassic([CLASSIC, mine]).map((p) => p.id)).toEqual(['classic', 'm']);
	});
});
