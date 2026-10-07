import { describe, expect, it } from 'vitest';
import { BANDS_MS, CARD_MS, FLING_MS, REVEAL_FORWARD_MS, REVEAL_SHORT_MS, direction, planFor, toolNumber } from './plan';

const tools = [
	{ name: 'Wallet', href: '/wallet' },
	{ name: 'Yellowpad', href: '/yellowpad' }
];
const base = { launch: null, tools, reduced: false, uaAnimated: false };

describe('direction', () => {
	it('goes forward into deeper paths and back out of them', () => {
		expect(direction('/', '/yellowpad')).toBe('forward');
		expect(direction('/wallet', '/wallet/manage')).toBe('forward');
		expect(direction('/yellowpad', '/')).toBe('back');
		expect(direction('/wallet/calendar', '/wallet/manage')).toBe('same');
	});
});

describe('toolNumber', () => {
	it('pads to two digits', () => {
		expect(toolNumber(0)).toBe('01');
		expect(toolNumber(11)).toBe('12');
	});
});

describe('planFor', () => {
	it('plays nothing with reduced motion, after an iOS swipe-back, or for the same path', () => {
		expect(planFor({ ...base, from: '/', to: '/yellowpad', reduced: true })).toBeNull();
		expect(planFor({ ...base, from: '/yellowpad', to: '/', uaAnimated: true })).toBeNull();
		expect(planFor({ ...base, from: '/yellowpad', to: '/yellowpad' })).toBeNull();
		expect(planFor({ ...base, from: '/', to: undefined })).toBeNull();
	});

	it('a launch from the dial gets its fling, then bands, then its title card', () => {
		const launch = { title: 'Yellowpad', number: '02', line: 'LAST · notes.md', fling: true };
		const p = planFor({ ...base, from: '/', to: '/yellowpad', launch })!;
		expect(p.dir).toBe('forward');
		expect(p.card).toEqual(launch);
		expect(p.bandsDelay).toBe(FLING_MS);
		expect(p.cardAt).toBe(FLING_MS + BANDS_MS);
		expect(p.coverMs).toBe(FLING_MS + BANDS_MS + CARD_MS);
		expect(p.revealMs).toBe(REVEAL_FORWARD_MS);
	});

	it('bands only wait for what is left of the fling (the page may have loaded meanwhile)', () => {
		const launch = { title: 'Yellowpad', number: '02', fling: true, at: 1000 };
		expect(planFor({ ...base, from: '/', to: '/yellowpad', launch, now: 1040 })!.bandsDelay).toBe(FLING_MS - 40);
		expect(planFor({ ...base, from: '/', to: '/yellowpad', launch, now: 1500 })!.bandsDelay).toBe(0);
	});

	it('a plain link into a tool still gets a title card, from the tools list', () => {
		const p = planFor({ ...base, from: '/', to: '/wallet' })!;
		expect(p.card).toEqual({ title: 'Wallet', number: '01' });
		expect(p.bandsDelay).toBe(0);
	});

	it('inner pages and going back get bands and shards only', () => {
		const inner = planFor({ ...base, from: '/wallet', to: '/wallet/manage' })!;
		expect(inner.card).toBeNull();
		expect(inner.coverMs).toBe(BANDS_MS);
		const back = planFor({ ...base, from: '/yellowpad', to: '/' })!;
		expect(back.dir).toBe('back');
		expect(back.card).toBeNull();
		expect(back.revealMs).toBe(REVEAL_SHORT_MS);
	});

	it('ignores a stale launch on a back navigation', () => {
		const p = planFor({ ...base, from: '/yellowpad', to: '/', launch: { title: 'X', number: '09', fling: true } })!;
		expect(p.card).toBeNull();
		expect(p.bandsDelay).toBe(0);
	});
});
