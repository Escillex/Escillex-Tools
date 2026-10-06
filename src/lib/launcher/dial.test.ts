import { describe, expect, it } from 'vitest';
import { EDGE, LOCK_PX, Once, PULL_THRESHOLD, PointerOwner, STEP_DEG, angleAt, geometry, lockDirection, pulledPast, releaseAction, rubber, spoke, ticks, wrap } from './dial';

describe('wrap', () => {
	it('wraps any integer into 0..n-1, negatives too', () => {
		expect(wrap(5, 3)).toBe(2);
		expect(wrap(-1, 3)).toBe(2);
		expect(wrap(-1, 1)).toBe(0);
		expect(wrap(0, 1)).toBe(0);
	});
});

describe('geometry', () => {
	it('puts the circle off the left edge with only EDGE px showing', () => {
		const g = geometry(390, 640);
		expect(g.cx + g.r).toBe(EDGE);
		expect(g.cy).toBe(320);
		expect(g.r).toBeGreaterThanOrEqual(310);
	});
	it('grows the circle on tall screens', () => {
		expect(geometry(390, 1000).r).toBe(420);
	});
});

describe('angleAt', () => {
	const g = { cx: -250, cy: 300, r: 310 };
	it('is 0 at 3 o’clock and positive below it', () => {
		expect(angleAt(100, 300, g)).toBeCloseTo(0);
		expect(angleAt(-250, 600, g)).toBeCloseTo(90);
		expect(angleAt(-250, 0, g)).toBeCloseTo(-90);
	});
});

describe('spoke', () => {
	it('hides the one under the slab', () => {
		expect(spoke(0).opacity).toBe(0);
		expect(spoke(0.4).opacity).toBe(0);
	});
	it('fades in as it leaves the slab, then shrinks and dims with distance', () => {
		expect(spoke(0.75).opacity).toBeCloseTo(0.5);
		expect(spoke(1)).toEqual({ scale: 1, tone: 'ink', opacity: 1 });
		expect(spoke(-2)).toEqual({ scale: 0.73, tone: 'dim', opacity: 1 });
		expect(spoke(3).tone).toBe('faint');
		expect(spoke(3).scale).toBeCloseTo(0.56);
	});
	it('is gone by 4.5 notches away', () => {
		expect(spoke(4.5).opacity).toBe(0);
		expect(spoke(-6).opacity).toBe(0);
	});
});

describe('ticks', () => {
	it('stays within ±80° and marks whole notches as major', () => {
		const list = ticks(0.5);
		expect(list.every((t) => Math.abs(t.angle) <= 80)).toBe(true);
		const major = list.find((t) => t.major && t.k === 4)!;
		expect(major.angle).toBeCloseTo((1 - 0.5) * STEP_DEG);
	});
	it('has four ticks per notch', () => {
		const list = ticks(0).filter((t) => t.angle >= 0 && t.angle < STEP_DEG);
		expect(list).toHaveLength(4);
	});
});

describe('lockDirection', () => {
	it('waits until the finger has moved LOCK_PX', () => {
		expect(lockDirection(LOCK_PX - 1, 0, true)).toBeNull();
	});
	it('pulls only for a rightward drag that started on the slab', () => {
		expect(lockDirection(20, 3, true)).toBe('pull');
		expect(lockDirection(20, 3, false)).toBe('turn');
		expect(lockDirection(-20, 3, true)).toBe('turn');
	});
	it('a mostly vertical drag on the slab turns the dial', () => {
		expect(lockDirection(5, 20, true)).toBe('turn');
	});
});

describe('pull', () => {
	it('resists, never runs past 60% of the width, and barely moves left', () => {
		expect(rubber(0, 400)).toBe(0);
		expect(rubber(10_000, 400)).toBeLessThanOrEqual(240);
		expect(rubber(-100, 400)).toBe(-20);
	});
	it('can still reach the threshold', () => {
		expect(pulledPast(rubber(400, 400), 400)).toBe(true);
		expect(pulledPast(rubber(60, 400), 400)).toBe(false);
		expect(pulledPast(400 * PULL_THRESHOLD, 400)).toBe(true);
	});
});

describe('releaseAction', () => {
	it('opens only on a real release past the line', () => {
		expect(releaseAction('pull', true, false)).toBe('launch');
		expect(releaseAction('pull', false, false)).toBe('snap');
	});
	it('a cancelled pull (system gesture) snaps back, even past the line', () => {
		expect(releaseAction('pull', true, true)).toBe('snap');
	});
	it('a turn throws; a cancelled turn just settles', () => {
		expect(releaseAction('turn', false, false)).toBe('throw');
		expect(releaseAction('turn', false, true)).toBe('settle');
	});
	it('a still press is a tap, unless it was cancelled', () => {
		expect(releaseAction(null, false, false)).toBe('tap');
		expect(releaseAction(null, false, true)).toBe('settle');
	});
});

describe('PointerOwner', () => {
	it('lets only the first finger drive until it lifts', () => {
		const p = new PointerOwner();
		expect(p.take(1)).toBe(true);
		expect(p.take(2)).toBe(false);
		expect(p.owns(2)).toBe(false);
		expect(p.release(2)).toBe(false);
		expect(p.release(1)).toBe(true);
		expect(p.take(2)).toBe(true);
	});
});

describe('Once', () => {
	it('lets a launch through only once', () => {
		const o = new Once();
		expect(o.claim()).toBe(true);
		expect(o.claim()).toBe(false);
	});
});
