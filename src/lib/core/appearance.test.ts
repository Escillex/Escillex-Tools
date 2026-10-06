import { describe, expect, it } from 'vitest';
import { cleanToolLook, resolveLook, type Look } from './appearance';

const global: Look = { bg: '#000000', ink: 'auto', accent: '#ffffff', font: 'barlow', read: 'space' };

describe('resolveLook', () => {
	it('uses the global look when the tool sets nothing', () => {
		expect(resolveLook(global, null)).toEqual(global);
		expect(resolveLook(global, {})).toEqual(global);
	});

	it('takes each key the tool sets', () => {
		expect(resolveLook(global, { accent: '#ff1a1a', read: 'mono' })).toEqual({ ...global, accent: '#ff1a1a', read: 'mono' });
	});

	it('makes text adapt when the tool picks a background but no text color', () => {
		const g = { ...global, ink: '#ffffff' };
		expect(resolveLook(g, { bg: '#efede8' }).ink).toBe('auto');
	});

	it('keeps an explicit tool text color', () => {
		expect(resolveLook(global, { bg: '#efede8', ink: '#000000' }).ink).toBe('#000000');
	});
});

describe('cleanToolLook', () => {
	const fonts = ['barlow', 'anton'];
	const reads = ['space', 'mono'];

	it('keeps valid keys', () => {
		expect(cleanToolLook({ bg: '#112233', ink: 'auto', font: 'anton', read: 'mono' }, fonts, reads)).toEqual({
			bg: '#112233',
			ink: 'auto',
			font: 'anton',
			read: 'mono'
		});
	});

	it('drops junk', () => {
		expect(cleanToolLook({ bg: 'red', accent: 3, font: 'comic', read: 'nope', extra: 1 }, fonts, reads)).toEqual({});
		expect(cleanToolLook(null, fonts, reads)).toEqual({});
		expect(cleanToolLook('x', fonts, reads)).toEqual({});
	});
});
