/** BG REMOVE's settings, stored per device in the shared settings table. Never synced. */
import { getSetting, setSetting } from '#lib/core/db.ts';
import { MAX_KEEP, clampKeep } from './history';

export const SKIP_MS = 12 * 3_600_000;

export interface Prefs {
	/** Last model used (a ModelId), or null on first visit. */
	model: string | null;
	autosave: boolean;
	keep: number;
	/** Expanded grid order; false = oldest → newest. */
	newestFirst: boolean;
	/** "Don't ask again" for deletes: until this time. Always runs out after 12 hours. */
	skipUntil: number | null;
	/** Permanently skip the delete prompt (needs two confirmations to turn on). */
	neverAsk: boolean;
}

export const DEFAULT_PREFS: Prefs = { model: null, autosave: true, keep: MAX_KEEP, newestFirst: false, skipUntil: null, neverAsk: false };

export const skipActive = (skipUntil: number | null, now: number) => skipUntil !== null && now < skipUntil;

export const shouldPrompt = (p: Pick<Prefs, 'skipUntil' | 'neverAsk'>, now: number) => !p.neverAsk && !skipActive(p.skipUntil, now);

const key = (k: keyof Prefs) => `bgremove:${k}`;

export async function loadPrefs(): Promise<Prefs> {
	const entries = await Promise.all((Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]).map(async (k) => [k, await getSetting(key(k))] as const));
	const p = { ...DEFAULT_PREFS };
	for (const [k, v] of entries) if (v !== undefined) (p as Record<string, unknown>)[k] = v;
	p.keep = clampKeep(p.keep);
	return p;
}

export const savePref = <K extends keyof Prefs>(k: K, value: Prefs[K]) => setSetting(key(k), value);
