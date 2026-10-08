import { describe, expect, it } from 'vitest';
import { installList, isLatinOf } from './offline';

const F = '/_app/immutable/assets/';

describe('isLatinOf', () => {
	it('matches only the basic Latin woff2 of that exact family', () => {
		expect(isLatinOf(`${F}barlow-latin-400-normal.qiz4-Cze.woff2`, 'barlow')).toBe(true);
		expect(isLatinOf(`${F}barlow-latin-ext-400-normal.abc.woff2`, 'barlow')).toBe(false);
		expect(isLatinOf(`${F}barlow-latin-400-normal.abc.woff`, 'barlow')).toBe(false);
		expect(isLatinOf(`${F}barlow-condensed-latin-900-italic.abc.woff2`, 'barlow')).toBe(false);
		expect(isLatinOf(`${F}archivo-black-latin-400-normal.abc.woff2`, 'archivo')).toBe(false);
		expect(isLatinOf(`${F}archivo-black-latin-400-normal.abc.woff2`, 'archivo-black')).toBe(true);
	});
});

describe('installList', () => {
	it('keeps only the default font, skips home-screen icons, and puts code first', () => {
		const list = installList([
			'/favicon.png',
			'/icon-512.png',
			'/apple-touch-icon.png',
			`${F}anton-latin-400-normal.a.woff2`,
			`${F}barlow-condensed-latin-900-italic.b.woff2`,
			`${F}barlow-condensed-cyrillic-900-italic.c.woff2`,
			`${F}barlow-condensed-latin-900-italic.b.woff`,
			'/_app/immutable/chunks/x.js',
			'/'
		]);
		expect(list).toEqual(['/_app/immutable/chunks/x.js', '/', `${F}barlow-condensed-latin-900-italic.b.woff2`, '/favicon.png']);
	});
});
