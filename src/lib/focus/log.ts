/**
 * The focus log: one row per focus block (breaks aren't logged). A block
 * belongs to the local day it started. Old rows are trimmed by turning
 * them into tombstones, so Sync all doesn't bring them back.
 */
import type { SyncFields } from '#lib/finance/db.ts';
import type { Ended } from './engine';

export interface LogRow extends SyncFields {
	start: number;
	end: number;
	minutes: number;
	/** true = ran its full length (a pomodoro); false = skipped or stopped (minutes only). */
	completed: boolean;
	label: string;
	taskId: string | null;
}

/** The id comes from the block's start, so two open windows logging the same block write one row. */
export function rowFrom(e: Ended, now: number, id = `focus-${e.start}`): LogRow {
	return { id, updatedAt: now, deleted: false, start: e.start, end: e.end, minutes: e.minutes, completed: e.completed, label: e.label, taskId: e.taskId };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD. */
export function dayKey(t: number): string {
	const d = new Date(t);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface Day {
	key: string;
	rows: LogRow[];
	pomodoros: number;
	minutes: number;
}

const total = (rows: LogRow[]) => ({
	pomodoros: rows.filter((r) => r.completed).length,
	minutes: rows.reduce((sum, r) => sum + r.minutes, 0)
});

/** Newest day first, newest row first within a day. */
export function groupByDay(rows: LogRow[]): Day[] {
	const days = new Map<string, LogRow[]>();
	for (const r of rows.filter((r) => !r.deleted).sort((a, b) => b.start - a.start)) {
		const key = dayKey(r.start);
		days.set(key, [...(days.get(key) ?? []), r]);
	}
	return [...days].map(([key, list]) => ({ key, rows: list, ...total(list) }));
}

export function todayTotals(rows: LogRow[], now: number): { pomodoros: number; minutes: number } {
	const today = dayKey(now);
	return total(rows.filter((r) => !r.deleted && dayKey(r.start) === today));
}

/** Ids of live rows that started before local midnight `keepDays` days ago. null = keep forever. */
export function toTrim(rows: LogRow[], keepDays: number | null, now: number): string[] {
	if (keepDays === null) return [];
	const d = new Date(now);
	const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() - keepDays).getTime();
	return rows.filter((r) => !r.deleted && r.start < cutoff).map((r) => r.id);
}

/** 40 → '40m', 160 → '2h 40m', 120 → '2h'. */
export function formatMinutes(m: number): string {
	const h = Math.floor(m / 60);
	const rest = m % 60;
	if (!h) return `${rest}m`;
	return rest ? `${h}h ${rest}m` : `${h}h`;
}
