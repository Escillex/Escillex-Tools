/**
 * The live counts while Fidget is open. Presses only touch memory; the
 * database gets one write a second at most (and one on leaving), so a
 * fast popping run isn't hundreds of IndexedDB writes. Facts unlock as
 * the total crosses each 250.
 */
import { TOY_IDS, type ToyId } from './toys';
import { factTarget, pickFact, type Fact } from './facts';
import type { CountRow, FactRow, Saved } from './db';

export const FLUSH_MS = 1000;

export interface CounterStore {
	saveCounts: (rows: CountRow[]) => Promise<unknown>;
	saveFact: (row: FactRow) => Promise<unknown>;
}

const zero = () => Object.fromEntries(TOY_IDS.map((t) => [t, 0])) as Record<ToyId, number>;

export class Counter {
	counts = $state(zero());
	unlocked = $state<string[]>([]);
	total = $derived(TOY_IDS.reduce((sum, t) => sum + this.counts[t], 0));

	#store: CounterStore;
	#rand: () => number;
	#now: () => number;
	#dirty = new Set<ToyId>();
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(store: CounterStore, rand: () => number = Math.random, now: () => number = Date.now) {
		this.#store = store;
		this.#rand = rand;
		this.#now = now;
	}

	load(saved: Saved) {
		this.counts = { ...zero(), ...saved.counts };
		this.unlocked = [...saved.unlocked];
	}

	/** One press. Returns the fact this press unlocked, if it earned one. */
	add(toy: ToyId): Fact | null {
		this.counts[toy]++;
		this.#dirty.add(toy);
		this.#timer ??= setTimeout(() => this.flush(), FLUSH_MS);

		if (this.unlocked.length >= factTarget(this.total)) return null;
		const fact = pickFact(new Set(this.unlocked), this.#rand);
		if (!fact) return null;
		this.unlocked.push(fact.id);
		const at = this.#now();
		// Facts are rare: written straight away, not batched.
		this.#store.saveFact({ id: fact.id, unlockedAt: at, updatedAt: at, deleted: false });
		return fact;
	}

	/** Write the changed counts now (leaving the page, or the app going to the background). */
	flush(): Promise<unknown> {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
		if (!this.#dirty.size) return Promise.resolve();
		const at = this.#now();
		const rows = [...this.#dirty].map((id) => ({ id, count: this.counts[id], updatedAt: at, deleted: false }));
		this.#dirty.clear();
		return this.#store.saveCounts(rows);
	}
}
