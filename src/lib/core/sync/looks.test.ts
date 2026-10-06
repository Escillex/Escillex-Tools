import { describe, expect, it } from 'vitest';
import { incomingLooks, isLookKey, outgoingLooks, type Looks } from './looks';

const dark = { bg: '#000000' };
const light = { bg: '#ffffff' };

describe('isLookKey', () => {
	it('accepts the global look and per-tool looks only', () => {
		expect(isLookKey('theme')).toBe(true);
		expect(isLookKey('theme:reader')).toBe(true);
		expect(isLookKey('currency')).toBe(false);
		expect(isLookKey('syncCode')).toBe(false);
		expect(isLookKey('reader:mode')).toBe(false);
	});
});

describe('incomingLooks', () => {
	it('takes a look that was changed more recently on another device', () => {
		const mine: Looks = { theme: { value: dark, at: 1 } };
		expect(incomingLooks(mine, [{ theme: { value: light, at: 2 } }])).toEqual({ theme: { value: light, at: 2 } });
	});

	it('keeps mine when mine is newer, or the same', () => {
		const mine: Looks = { theme: { value: dark, at: 5 } };
		expect(incomingLooks(mine, [{ theme: { value: light, at: 2 } }])).toEqual({});
		expect(incomingLooks(mine, [{ theme: { value: dark, at: 9 } }])).toEqual({});
	});

	it('takes looks this device has never set', () => {
		expect(incomingLooks({}, [{ 'theme:reader': { value: { read: 'mono' }, at: 3 } }])).toEqual({
			'theme:reader': { value: { read: 'mono' }, at: 3 }
		});
	});

	it('picks the newest across several devices', () => {
		const remotes = [{ theme: { value: light, at: 2 } }, { theme: { value: { bg: '#ffd60a' }, at: 4 } }];
		expect(incomingLooks({}, remotes).theme.at).toBe(4);
	});

	it('ignores other settings and malformed entries', () => {
		const remotes = [{ syncCode: { value: { x: 1 }, at: 9 }, theme: { value: 'red', at: 9 }, 'theme:wallet': { value: {}, at: 'soon' } }] as unknown as Looks[];
		expect(incomingLooks({}, remotes)).toEqual({});
	});

	it('copes with snapshots that have no looks at all (older app versions)', () => {
		expect(incomingLooks({}, [undefined])).toEqual({});
	});
});

describe('outgoingLooks', () => {
	it('counts my looks that are newer than every other device', () => {
		const mine: Looks = { theme: { value: dark, at: 5 }, 'theme:reader': { value: { read: 'mono' }, at: 1 } };
		expect(outgoingLooks(mine, [{ theme: { value: light, at: 2 }, 'theme:reader': { value: { read: 'mono' }, at: 3 } }])).toBe(1);
	});
});
