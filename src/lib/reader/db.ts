/**
 * The Reader's own database: just the recent files list. File handles
 * can be stored in IndexedDB, so a file can be reopened later without a
 * picker (the browser may ask for permission again). Never synced: a
 * handle only means something on this device.
 */
import Dexie, { type EntityTable } from 'dexie';
import { previewOf, touch, type Recent } from './recent';

const db = new Dexie('reader') as Dexie & { recent: EntityTable<Recent, 'id'> };

// Bump the version number whenever this schema changes. (preview isn't indexed, so adding it didn't need one.)
db.version(1).stores({ recent: 'id, openedAt' });

export const listRecent = () => db.recent.orderBy('openedAt').reverse().toArray();

async function sameAs(handle: FileSystemFileHandle) {
	const list = await db.recent.toArray();
	const sameFile = await Promise.all(list.map((r) => r.handle.isSameEntry(handle).catch(() => false)));
	return { list, sameFile };
}

/** Put a just-opened file at the top of the list, with a preview of its text. */
export async function rememberFile(handle: FileSystemFileHandle, text: string): Promise<void> {
	const { list, sameFile } = await sameAs(handle);
	const entry: Recent = { id: crypto.randomUUID(), name: handle.name, handle, openedAt: Date.now(), preview: previewOf(text) };
	const { keep, drop } = touch(list, entry, sameFile);
	await db.transaction('rw', db.recent, async () => {
		await db.recent.bulkDelete(drop.map((r) => r.id));
		await db.recent.put(keep[0]);
	});
}

/** After a save: refresh the file's preview (its place in the list stays). */
export async function refreshPreview(handle: FileSystemFileHandle, text: string): Promise<void> {
	const { list, sameFile } = await sameAs(handle);
	const i = sameFile.indexOf(true);
	if (i >= 0) await db.recent.update(list[i].id, { preview: previewOf(text) });
}

export const forgetRecent = (id: string) => db.recent.delete(id);
