import { describe, expect, it, vi } from 'vitest';
import { Detent, easeOutCubic, settleDuration } from './detent.svelte';

/** A fake animation-frame clock: run() steps every queued frame forward. */
function clock() {
	let queue: ((now: number) => void)[] = [];
	let t = 0;
	let now = 0;
	return {
		raf: (cb: (now: number) => void) => (queue.push(cb), queue.length),
		caf: () => (queue = []),
		now: () => now,
		setNow: (v: number) => (now = v),
		run(ms = 16, max = 500) {
			for (let i = 0; i < max && queue.length; i++) {
				t += ms;
				const current = queue;
				queue = [];
				current.forEach((f) => f(t));
			}
		}
	};
}

function make(start = 0) {
	const c = clock();
	const notches: number[] = [];
	const d = new Detent(start, { onNotch: (r) => notches.push(r), raf: c.raf, caf: c.caf, now: c.now });
	return { c, d, notches };
}

describe('easing', () => {
	it('starts at 0, ends at 1', () => {
		expect(easeOutCubic(0)).toBe(0);
		expect(easeOutCubic(1)).toBe(1);
	});
	it('takes longer for longer distances, capped at 900ms', () => {
		expect(settleDuration(0)).toBe(260);
		expect(settleDuration(2)).toBe(400);
		expect(settleDuration(-50)).toBe(900);
	});
});

describe('Detent', () => {
	it('fires onNotch once per new rounded position while dragging', () => {
		const { d, notches } = make();
		d.grab();
		d.moveTo(0.4);
		d.moveTo(0.6);
		d.moveTo(1.4);
		d.moveTo(1.6);
		expect(notches).toEqual([1, 2]);
	});

	it('handles negative positions', () => {
		const { d, notches } = make();
		d.grab();
		d.moveTo(-0.6);
		d.moveTo(-1.6);
		expect(notches).toEqual([-1, -2]);
		expect(d.rounded).toBe(-2);
	});

	it('animateTo lands exactly on the target and calls done', () => {
		const { c, d } = make(0.3);
		const done = vi.fn();
		d.animateTo(3, done);
		c.run();
		expect(d.pos).toBe(3);
		expect(done).toHaveBeenCalledOnce();
	});

	it('a slow release settles on the nearest notch', () => {
		const { c, d } = make();
		c.setNow(0);
		d.grab();
		c.setNow(1000);
		d.moveTo(0.3); // 0.0003 notches/ms → +0.08: still nearest 0
		d.release();
		c.run();
		expect(d.pos).toBe(0);
	});

	it('a fast release throws further in the direction of travel', () => {
		const { c, d } = make();
		c.setNow(0);
		d.grab();
		c.setNow(10);
		d.moveTo(0.5); // 0.05 notches per ms → +14 over THROW_MS
		d.release();
		c.run();
		expect(d.pos).toBe(15);
	});

	it('jump moves without firing onNotch', () => {
		const { d, notches } = make();
		d.jump(4);
		expect(d.pos).toBe(4);
		d.grab();
		d.moveTo(4.2);
		expect(notches).toEqual([]);
	});

	it('grab stops a running animation where it is', () => {
		const { c, d } = make();
		d.animateTo(10);
		c.run(16, 3);
		const at = d.pos;
		d.grab();
		c.run();
		expect(d.pos).toBe(at);
	});
});
