/**
 * BG REMOVE's history: its own database, so a full disk or Clear all can
 * never touch wallet or Yellowpad data. This device only, never synced.
 */
import Dexie, { type EntityTable } from 'dexie';
import { isQuota, prunePlan, type Cutout } from './history';

const db = new Dexie('bgremove') as Dexie & { cutouts: EntityTable<Cutout, 'id'> };

// Bump the version number whenever this schema changes.
db.version(1).stores({ cutouts: 'id, createdAt' });

/** Oldest first. (Blobs come back as handles; their bytes aren't read until used.) */
export const listCutouts = () => db.cutouts.orderBy('createdAt').toArray();

export const deleteCutout = (id: string) => db.cutouts.delete(id);
export const clearCutouts = () => db.cutouts.clear();

/** Expired ones, and the oldest beyond `keep`. Returns how many went. */
export async function pruneCutouts(now: number, keep: number): Promise<number> {
	const ids = prunePlan(await db.cutouts.toArray(), now, keep);
	if (ids.length) await db.cutouts.bulkDelete(ids);
	return ids.length;
}

/**
 * Save, keeping at most `keep`. When the disk is full, delete the oldest
 * and try again. `removed` counts only those deleted to make room. Throws
 * the quota error if there's nothing left to delete.
 */
export async function saveCutout(c: Cutout, keep: number): Promise<{ removed: number }> {
	let removed = 0;
	for (;;) {
		try {
			await db.transaction('rw', db.cutouts, async () => {
				const ids = await db.cutouts.orderBy('createdAt').primaryKeys();
				const extra = ids.length + 1 - keep;
				if (extra > 0) await db.cutouts.bulkDelete(ids.slice(0, extra));
				await db.cutouts.add(c);
			});
			return { removed };
		} catch (e) {
			if (!isQuota(e)) throw e;
			const oldest = await db.cutouts.orderBy('createdAt').first();
			if (!oldest) throw e;
			await db.cutouts.delete(oldest.id);
			removed++;
		}
	}
}
