/**
 * FOCUS's own database: your presets, tasks and the focus log. All three
 * go through Sync all (syncTables): it's a manual swap, so a log that
 * grows with every block costs no requests until you sync.
 * Deletes are tombstones, so they reach the other device too.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { Preset } from './presets';
import type { Task } from './tasks';
import type { LogRow } from './log';

export const db = new Dexie('focus') as Dexie & {
	presets: EntityTable<Preset, 'id'>;
	tasks: EntityTable<Task, 'id'>;
	log: EntityTable<LogRow, 'id'>;
};

// Bump the version number whenever this schema changes.
db.version(1).stores({ presets: 'id', tasks: 'id', log: 'id, start' });

/** Every row, tombstones included: the screens filter them out. */
export async function loadAll(): Promise<{ presets: Preset[]; tasks: Task[]; log: LogRow[] }> {
	const [presets, tasks, log] = await Promise.all([db.presets.toArray(), db.tasks.toArray(), db.log.toArray()]);
	return { presets, tasks, log };
}

export const putPreset = (p: Preset) => db.presets.put(p);
export const putTask = (t: Task) => db.tasks.put(t);

/**
 * Logs ended blocks and gives each finished one to its task. A row that's
 * already there (another open window logged it first) is skipped, so the
 * task isn't counted twice.
 */
export async function record(rows: LogRow[], now: number): Promise<void> {
	await db.transaction('rw', db.log, db.tasks, async () => {
		const have = await db.log.bulkGet(rows.map((r) => r.id));
		for (const [i, r] of rows.entries()) {
			if (have[i]) continue;
			await db.log.put(r);
			if (!r.completed || !r.taskId) continue;
			const t = await db.tasks.get(r.taskId);
			if (t && !t.deleted) await db.tasks.put({ ...t, count: t.count + 1, updatedAt: now });
		}
	});
}

export async function tombstone(table: 'presets' | 'tasks' | 'log', ids: string[], now: number): Promise<void> {
	if (!ids.length) return;
	await db.table(table).where('id').anyOf(ids).modify({ deleted: true, updatedAt: now });
}
