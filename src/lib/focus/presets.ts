/**
 * Timer presets. Classic 25 / 5 / 15 (long break every 4) lives in code,
 * never in the database, so it can't be deleted or drift through sync.
 * Your own presets are synced rows.
 */
import type { SyncFields } from '#lib/finance/db.ts';

/** Minutes, plus `every` = focus blocks per cycle before the long break. */
export interface Lengths {
	focus: number;
	break: number;
	long: number;
	every: number;
}

export interface Preset extends SyncFields, Lengths {
	name: string;
}

export const CLASSIC: Preset = { id: 'classic', updatedAt: 0, deleted: false, name: 'Classic', focus: 25, break: 5, long: 15, every: 4 };

export const LIMITS = { minutes: [1, 180], every: [1, 12] } as const;

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(n)));
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Lengths clamped into LIMITS, or null when any of them isn't a number. */
export function cleanLengths(raw: unknown): Lengths | null {
	const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	if (!isNum(r.focus) || !isNum(r.break) || !isNum(r.long) || !isNum(r.every)) return null;
	return {
		focus: clamp(r.focus, LIMITS.minutes),
		break: clamp(r.break, LIMITS.minutes),
		long: clamp(r.long, LIMITS.minutes),
		every: clamp(r.every, LIMITS.every)
	};
}

export function cleanPreset(raw: unknown): Preset | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	if (typeof r.id !== 'string' || !r.id) return null;
	const lengths = cleanLengths(r);
	if (!lengths) return null;
	const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim() : 'Preset';
	return { id: r.id, updatedAt: isNum(r.updatedAt) ? r.updatedAt : 0, deleted: r.deleted === true, name, ...lengths };
}

/** The live presets with Classic always first (a stored row with Classic's id is ignored). */
export function withClassic(presets: Preset[]): Preset[] {
	return [CLASSIC, ...presets.filter((p) => !p.deleted && p.id !== CLASSIC.id)];
}

/** The preset you used last, or Classic when it's gone. */
export function pickPreset(presets: Preset[], id: string | undefined): Preset {
	return presets.find((p) => p.id === id && !p.deleted) ?? CLASSIC;
}
