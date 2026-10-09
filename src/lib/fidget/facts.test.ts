import { describe, expect, it } from 'vitest';
import { FACT_EVERY, TRIVIA, conversion, factTarget, pickFact, untilNext } from './facts';
import { TOY_IDS } from './toys';

describe('trivia', () => {
	it('has 60 facts with unique, stable ids', () => {
		expect(TRIVIA).toHaveLength(60);
		expect(new Set(TRIVIA.map((f) => f.id)).size).toBe(60);
		expect(TRIVIA[0].id).toBe('f01');
		expect(TRIVIA[59].id).toBe('f60');
		for (const f of TRIVIA) expect(f.text.length).toBeGreaterThan(10);
	});
});

describe('unlocking', () => {
	it('one fact per 250, capped at 60', () => {
		expect(FACT_EVERY).toBe(250);
		expect(factTarget(0)).toBe(0);
		expect(factTarget(249)).toBe(0);
		expect(factTarget(250)).toBe(1);
		expect(factTarget(1_000_000)).toBe(60);
	});
	it('pickFact never returns one already unlocked', () => {
		const unlocked = new Set(TRIVIA.slice(0, 59).map((f) => f.id));
		expect(pickFact(unlocked, () => 0.99)?.id).toBe('f60');
		expect(pickFact(new Set(TRIVIA.map((f) => f.id)))).toBeNull();
	});
	it('pickFact uses rand to choose among the rest', () => {
		expect(pickFact(new Set(), () => 0)?.id).toBe('f01');
		expect(pickFact(new Set(), () => 0.999)?.id).toBe('f60');
	});
	it('untilNext counts presses to the next unlock', () => {
		expect(untilNext(0, 0)).toBe(250);
		expect(untilNext(240, 0)).toBe(10);
		expect(untilNext(250, 1)).toBe(250);
	});
	it('untilNext: behind (total jumped) → the next press', () => {
		expect(untilNext(1000, 1)).toBe(1);
	});
	it('untilNext: more unlocked than the total implies (old backup restored) → never negative', () => {
		expect(untilNext(100, 3)).toBe(900);
	});
	it('untilNext: all found → null', () => {
		expect(untilNext(99_999, 60)).toBeNull();
	});
});

describe('conversion', () => {
	it('every toy has a line', () => {
		for (const t of TOY_IDS) expect(conversion(t, 500)).toMatch(/^= /);
	});
	it('nothing yet', () => {
		expect(conversion('bubbles', 0)).toBe('Nothing yet. Go on.');
	});
	it('one decimal under 10, whole numbers above', () => {
		expect(conversion('bubbles', 96)).toBe('= 2.0 full 6×8 sheets');
		expect(conversion('bubbles', 2400)).toBe('= 50 full 6×8 sheets');
	});
	it('a unit too big to show yet (0.0 marathons) falls back to the smallest one', () => {
		expect(conversion('slider', 233)).toBe('= 23 trips across a 10-notch slider');
	});
	it('the line changes every 100 actions', () => {
		expect(conversion('bubbles', 120)).toBe('= 2.0 minutes at one pop a second');
	});
});
