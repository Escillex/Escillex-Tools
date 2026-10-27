/**
 * FOCUS's per-device settings, never synced: the last preset, the
 * auto-start rules, how long the log is kept, the alert switches, and the
 * running timer itself (one timer per device).
 */
import { getSetting, setSetting } from '#lib/core/db.ts';
import { cleanLengths } from './presets';
import type { Phase, Rules, Run } from './engine';

export const DEFAULT_RULES: Rules = { autoStart: true, stopAfter: 1 };
/** Stop after 1 / 2 / 3 / 4 cycles, or never (0). */
export const STOP_AFTER = [1, 2, 3, 4, 0] as const;

export type Keep = 'week' | 'month' | 'quarter' | 'year' | 'forever';
export const KEEP_DAYS: Record<Keep, number | null> = { week: 7, month: 30, quarter: 90, year: 365, forever: null };

const PHASES: Phase[] = ['focus', 'break', 'long'];
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const obj = (raw: unknown) => (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

export function cleanRules(raw: unknown): Rules {
	const r = obj(raw);
	return {
		autoStart: typeof r.autoStart === 'boolean' ? r.autoStart : DEFAULT_RULES.autoStart,
		stopAfter: (STOP_AFTER as readonly unknown[]).includes(r.stopAfter) ? (r.stopAfter as number) : DEFAULT_RULES.stopAfter
	};
}

export function cleanKeep(raw: unknown): Keep {
	return typeof raw === 'string' && Object.hasOwn(KEEP_DAYS, raw) ? (raw as Keep) : 'month';
}

/** A saved run from an older build or a hand edit: fix what's harmless, drop it if the timing is broken. */
export function cleanRun(raw: unknown): Run | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const r = raw as Record<string, unknown>;
	const lengths = cleanLengths(r.lengths);
	if (!lengths || !PHASES.includes(r.phase as Phase)) return null;
	if (!isNum(r.round) || !isNum(r.cycle) || !isNum(r.pausedMs)) return null;
	if (r.startedAt !== null && !isNum(r.startedAt)) return null;
	if (r.pausedAt !== null && !isNum(r.pausedAt)) return null;
	return {
		lengths,
		phase: r.phase as Phase,
		round: Math.min(Math.max(1, Math.round(r.round)), lengths.every),
		cycle: Math.max(1, Math.round(r.cycle)),
		startedAt: r.startedAt as number | null,
		pausedAt: r.pausedAt as number | null,
		pausedMs: Math.max(0, r.pausedMs),
		label: typeof r.label === 'string' ? r.label : '',
		taskId: typeof r.taskId === 'string' ? r.taskId : null
	};
}

export interface FocusPrefs {
	preset: string | undefined;
	rules: Rules;
	keep: Keep;
	notify: boolean;
	wakeLock: boolean;
	run: Run | null;
}

export async function loadFocusPrefs(): Promise<FocusPrefs> {
	const [preset, rules, keep, notify, wakeLock, run] = await Promise.all(
		['focus:preset', 'focus:rules', 'focus:keep', 'focus:notify', 'focus:wakeLock', 'focus:run'].map((k) => getSetting<unknown>(k))
	);
	return {
		preset: typeof preset === 'string' ? preset : undefined,
		rules: cleanRules(rules),
		keep: cleanKeep(keep),
		// Notifications: on unless switched off. Wake lock: off unless switched on (heat and battery).
		notify: notify !== false,
		wakeLock: wakeLock === true,
		run: cleanRun(run)
	};
}

// Pass plain objects ($state.snapshot), not $state proxies: IndexedDB can't store proxies.
export const savePresetId = (id: string) => setSetting('focus:preset', id);
export const saveRules = (r: Rules) => setSetting('focus:rules', r);
export const saveKeep = (k: Keep) => setSetting('focus:keep', k);
export const saveNotify = (on: boolean) => setSetting('focus:notify', on);
export const saveWakeLock = (on: boolean) => setSetting('focus:wakeLock', on);
export const saveRun = (r: Run | null) => setSetting('focus:run', r);
