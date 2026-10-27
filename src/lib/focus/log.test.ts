import { describe, expect, it } from 'vitest';
import { dayKey, formatMinutes, groupByDay, rowFrom, todayTotals, toTrim, type LogRow } from './log';

/** Local time on a day in October 2026. */
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
let n = 0;
const row = (over: Partial<LogRow>): LogRow => ({
	id: `r${n++}`,
	updatedAt: 0,
	deleted: false,
	start: 0,
	end: 0,
	minutes: 25,
	completed: true,
	label: '',
	taskId: null,
	...over
});

describe('log', () => {
	it('groups by the local day a block started, newest first, with totals', () => {
		const late = row({ start: at(26, 23, 50), end: at(27, 0, 15), minutes: 25, completed: true });
		const a = row({ start: at(27, 9), minutes: 25, completed: true });
		const b = row({ start: at(27, 10), minutes: 12, completed: false });
		const days = groupByDay([late, a, b]);
		expect(days.map((d) => d.key)).toEqual(['2026-10-27', '2026-10-26']);
		expect(days[0]).toMatchObject({ pomodoros: 1, minutes: 37 });
		expect(days[0].rows.map((r) => r.id)).toEqual([b.id, a.id]);
		expect(days[1]).toMatchObject({ pomodoros: 1, minutes: 25 });
	});

	it('today totals ignore other days and tombstones', () => {
		const rows = [row({ start: at(27, 9) }), row({ start: at(27, 9), deleted: true }), row({ start: at(26, 9) })];
		expect(todayTotals(rows, at(27, 18))).toEqual({ pomodoros: 1, minutes: 25 });
	});

	it('trims rows older than keepDays, by local midnight', () => {
		const old = row({ start: at(20, 23) });
		const edge = row({ start: at(21, 0, 1) });
		expect(toTrim([old, edge], 7, at(28, 9))).toEqual([old.id]);
		expect(toTrim([old, edge], null, at(28, 9))).toEqual([]);
		expect(toTrim([{ ...old, deleted: true }], 7, at(28, 9))).toEqual([]);
	});

	it('formats minutes', () => {
		expect([formatMinutes(40), formatMinutes(160), formatMinutes(120), formatMinutes(0)]).toEqual(['40m', '2h 40m', '2h', '0m']);
	});

	it('dayKey is the local date', () => {
		expect(dayKey(at(3, 0, 5))).toBe('2026-10-03');
	});

	it('rowFrom copies an ended block', () => {
		const r = rowFrom({ phase: 'focus', start: 1, end: 2, minutes: 25, completed: true, label: 'x', taskId: 't' }, 9, 'id1');
		expect(r).toEqual({ id: 'id1', updatedAt: 9, deleted: false, start: 1, end: 2, minutes: 25, completed: true, label: 'x', taskId: 't' });
	});

	it('rowFrom ids default to the block start', () => {
		expect(rowFrom({ phase: 'focus', start: 123, end: 2, minutes: 1, completed: true, label: '', taskId: null }, 9).id).toBe('focus-123');
	});
});
