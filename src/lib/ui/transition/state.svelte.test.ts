import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Curtain } from './state.svelte';
import type { Plan } from './plan';

const plan = (over: Partial<Plan> = {}): Plan => ({ dir: 'forward', card: null, bandsDelay: 0, cardAt: 190, coverMs: 190, revealMs: 200, ...over });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Curtain', () => {
	it('covers, then reveals, then goes idle', async () => {
		const c = new Curtain();
		const covered = c.cover(plan());
		expect(c.phase).toBe('cover');
		await vi.advanceTimersByTimeAsync(190);
		await covered;
		expect(c.phase).toBe('covered');
		const done = c.reveal();
		expect(c.phase).toBe('reveal');
		await vi.advanceTimersByTimeAsync(200);
		await done;
		expect(c.phase).toBe('idle');
		expect(c.plan).toBeNull();
	});

	it('interrupting resolves the earlier promise and jumps straight to covered', async () => {
		const c = new Curtain();
		let first = false;
		c.cover(plan()).then(() => (first = true));
		await vi.advanceTimersByTimeAsync(50);
		const second = c.cover(plan({ dir: 'back' }));
		await second;
		await vi.advanceTimersByTimeAsync(0);
		expect(first).toBe(true);
		expect(c.phase).toBe('covered');
		expect(c.plan?.dir).toBe('back');
	});

	it('a new navigation during the reveal covers again at once', async () => {
		const c = new Curtain();
		const p = c.cover(plan());
		await vi.advanceTimersByTimeAsync(190);
		await p;
		let revealed = false;
		c.reveal().then(() => (revealed = true));
		await vi.advanceTimersByTimeAsync(50);
		await c.cover(plan());
		await vi.advanceTimersByTimeAsync(0);
		expect(revealed).toBe(true);
		expect(c.phase).toBe('covered');
	});

	it('reveal with nothing covered does nothing', async () => {
		const c = new Curtain();
		await c.reveal();
		expect(c.phase).toBe('idle');
	});

	it('take() hands over what arm() left, once', () => {
		const c = new Curtain();
		c.arm({ title: 'Yellowpad', number: '02', fling: true });
		expect(c.take()?.title).toBe('Yellowpad');
		expect(c.take()).toBeNull();
	});
});
