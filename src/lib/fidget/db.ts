/**
 * Fidget's own database: how many times each toy was used, and which
 * facts are unlocked. In .escb backups (backupTables), never live-synced:
 * a counter changes on every press. One count row per toy, id = toy id.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { SyncFields } from '#lib/finance/db.ts';
import type { ToyId } from './toys';

export interface CountRow extends SyncFields {
	count: number;
}

export interface FactRow extends SyncFields {
	unlockedAt: number;
}

export const db = new Dexie('fidget') as Dexie & {
	counts: EntityTable<CountRow, 'id'>;
	facts: EntityTable<FactRow, 'id'>;
};

// Bump the version number whenever this schema changes.
db.version(1).stores({ counts: 'id', facts: 'id' });

export interface Saved {
	counts: Partial<Record<ToyId, number>>;
	/** Fact ids, oldest unlock first. */
	unlocked: string[];
}

export async function loadCounts(): Promise<Saved> {
	const [counts, facts] = await Promise.all([db.counts.toArray(), db.facts.toArray()]);
	return {
		counts: Object.fromEntries(counts.filter((r) => !r.deleted).map((r) => [r.id, r.count])),
		unlocked: facts
			.filter((f) => !f.deleted)
			.sort((a, b) => a.unlockedAt - b.unlockedAt)
			.map((f) => f.id)
	};
}

export const saveCounts = (rows: CountRow[]) => db.counts.bulkPut(rows);
export const saveFact = (row: FactRow) => db.facts.put(row);
