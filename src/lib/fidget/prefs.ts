/** Fidget's per-device settings: the last toy used and each toy's preset. Never synced. */
import { getSetting, setSetting } from '#lib/core/db.ts';
import { cleanToyPrefs, isToyId, type ToyId, type ToyPrefs } from './toys';

export async function loadFidgetPrefs(): Promise<{ toy: ToyId; toys: ToyPrefs }> {
	const [toy, toys] = await Promise.all([getSetting('fidget:toy'), getSetting('fidget:toys')]);
	return { toy: isToyId(toy) ? toy : 'bubbles', toys: cleanToyPrefs(toys) };
}

export const saveToy = (t: ToyId) => setSetting('fidget:toy', t);

/** Pass a plain object ($state.snapshot), not a $state proxy: IndexedDB can't store proxies. */
export const saveToyPrefs = (p: ToyPrefs) => setSetting('fidget:toys', p);
