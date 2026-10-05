import Dexie, { type EntityTable } from 'dexie';

/**
 * Shared, device-level data used by every tool: this device's id and,
 * later, the sync code. Never synced itself.
 */
export interface Setting {
	key: string;
	value: unknown;
}

export const coreDb = new Dexie('core') as Dexie & {
	settings: EntityTable<Setting, 'key'>;
};

coreDb.version(1).stores({
	settings: 'key'
});

export async function getSetting<T>(key: string): Promise<T | undefined> {
	return (await coreDb.settings.get(key))?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
	await coreDb.settings.put({ key, value });
}

/**
 * Runs once per app start: gives this device an id (used by sync later)
 * and asks the browser not to clear our data when space runs low.
 */
export async function initDevice(): Promise<void> {
	if (!(await getSetting('deviceId'))) {
		await setSetting('deviceId', crypto.randomUUID());
	}
	if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
		await navigator.storage.persist();
	}
}
