import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Counter, FLUSH_MS } from './counter.svelte';
import { TRIVIA } from './facts';

function setup(rand = () => 0) {
	const store = { saveCounts: vi.fn(async () => {}), saveFact: vi.fn(async () => {}) };
	const counter = new Counter(store, rand, () => 5000);
	return { store, counter };
}

describe('Counter', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('counts per toy and in total', () => {
		const { counter } = setup();
		counter.add('pen');
		counter.add('pen');
		counter.add('bubbles');
		expect(counter.counts.pen).toBe(2);
		expect(counter.counts.bubbles).toBe(1);
		expect(counter.total).toBe(3);
	});

	it('writes at most once a second, with the latest counts', () => {
		const { store, counter } = setup();
		for (let i = 0; i < 30; i++) counter.add('bubbles');
		expect(store.saveCounts).not.toHaveBeenCalled();
		vi.advanceTimersByTime(FLUSH_MS);
		expect(store.saveCounts).toHaveBeenCalledTimes(1);
		expect(store.saveCounts).toHaveBeenCalledWith([{ id: 'bubbles', count: 30, updatedAt: 5000, deleted: false }]);
	});

	it('flush() writes now and cancels the pending write', async () => {
		const { store, counter } = setup();
		counter.add('keys');
		await counter.flush();
		vi.advanceTimersByTime(FLUSH_MS * 3);
		expect(store.saveCounts).toHaveBeenCalledTimes(1);
	});

	it('flush() with nothing new writes nothing', async () => {
		const { store, counter } = setup();
		await counter.flush();
		expect(store.saveCounts).not.toHaveBeenCalled();
	});

	it('unlocks a fact on the 250th press, and saves it', () => {
		const { store, counter } = setup();
		for (let i = 0; i < 249; i++) expect(counter.add('slider')).toBeNull();
		const fact = counter.add('slider');
		expect(fact?.id).toBe('f01');
		expect(counter.unlocked).toEqual(['f01']);
		expect(store.saveFact).toHaveBeenCalledWith({ id: 'f01', unlockedAt: 5000, updatedAt: 5000, deleted: false });
		expect(counter.add('slider')).toBeNull();
	});

	it('load restores counts and facts; a total that is ahead unlocks one per press', () => {
		const { counter } = setup();
		counter.load({ counts: { ratchet: 1000 }, unlocked: ['f01'] });
		expect(counter.total).toBe(1000);
		expect(counter.counts.pen).toBe(0);
		expect(counter.add('ratchet')?.id).toBe('f02');
		expect(counter.unlocked).toHaveLength(2);
	});

	it('more facts than the total implies (old backup): nothing extra unlocks, nothing lost', () => {
		const { counter } = setup();
		counter.load({ counts: { pen: 10 }, unlocked: ['f05', 'f09'] });
		expect(counter.add('pen')).toBeNull();
		expect(counter.unlocked).toEqual(['f05', 'f09']);
	});

	it('all 60 found: no more unlocks', () => {
		const { counter } = setup();
		counter.load({ counts: { pen: 999_999 }, unlocked: TRIVIA.map((f) => f.id) });
		expect(counter.add('pen')).toBeNull();
	});
});
