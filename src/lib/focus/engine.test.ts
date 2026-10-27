import { describe, expect, it } from 'vitest';
import { advance, begin, pause, phaseMs, remaining, resume, skip, stop } from './engine';

const M = 60_000;
const L = { focus: 25, break: 5, long: 15, every: 2 };
const on = { autoStart: true, stopAfter: 1 };
const off = { autoStart: false, stopAfter: 1 };

describe('engine', () => {
	it('counts down from the focus length', () => {
		const r = begin(L, 'essay', null, 0);
		expect(remaining(r, 10 * M)).toBe(15 * M);
		expect(advance(r, on, 24 * M).ended).toEqual([]);
	});

	it('ends focus into a break that starts exactly at the focus end', () => {
		const s = advance(begin(L, 'essay', 't1', 0), on, 26 * M);
		expect(s.ended).toEqual([{ phase: 'focus', start: 0, end: 25 * M, minutes: 25, completed: true, label: 'essay', taskId: 't1' }]);
		expect(s.run).toMatchObject({ phase: 'break', round: 1, startedAt: 25 * M });
	});

	it('catches up a whole cycle at once and stops after stopAfter cycles', () => {
		// 25 + 5 + 25 + 15 = 70 min
		const s = advance(begin(L, '', null, 0), on, 5 * 60 * M);
		expect(s.ended.map((e) => e.phase)).toEqual(['focus', 'break', 'focus', 'long']);
		expect(s.ended.at(-1)!.end).toBe(70 * M);
		expect(s.run).toBeNull();
	});

	it('keeps going into cycle 2 when stopAfter allows, and forever with 0', () => {
		expect(advance(begin(L, '', null, 0), { autoStart: true, stopAfter: 2 }, 71 * M).run).toMatchObject({ phase: 'focus', round: 1, cycle: 2 });
		expect(advance(begin(L, '', null, 0), { autoStart: true, stopAfter: 0 }, 10 * 70 * M + M).run).not.toBeNull();
	});

	it('without autoStart, waits after each phase', () => {
		const s = advance(begin(L, '', null, 0), off, 3 * 60 * M);
		expect(s.ended).toHaveLength(1);
		expect(s.run).toMatchObject({ phase: 'break', startedAt: null });
		expect(remaining(s.run!, 4 * 60 * M)).toBe(5 * M);
		expect(resume(s.run!, 4 * 60 * M).startedAt).toBe(4 * 60 * M);
	});

	it('freezes while paused and leaves paused time out of minutes', () => {
		let r = pause(begin(L, '', null, 0), 10 * M);
		expect(remaining(r, 50 * M)).toBe(15 * M);
		expect(advance(r, on, 50 * M).ended).toEqual([]);
		r = resume(r, 50 * M); // 40 min paused
		const s = advance(r, on, 66 * M);
		expect(s.ended[0]).toMatchObject({ start: 0, end: 65 * M, minutes: 25, completed: true });
	});

	it('skip ends focus early: minutes only, not completed, then the break', () => {
		const s = skip(begin(L, 'x', null, 0), on, 12.5 * M);
		expect(s.ended[0]).toMatchObject({ phase: 'focus', minutes: 12, completed: false, end: 12.5 * M });
		expect(s.run).toMatchObject({ phase: 'break', startedAt: 12.5 * M });
	});

	it('skipping a break logs it as ended but nothing else changes', () => {
		const brk = advance(begin(L, '', null, 0), on, 26 * M).run!;
		const s = skip(brk, on, 27 * M);
		expect(s.ended[0].phase).toBe('break');
		expect(s.run).toMatchObject({ phase: 'focus', round: 2, startedAt: 27 * M });
	});

	it('skip on a waiting phase moves past it without an Ended', () => {
		const waiting = advance(begin(L, '', null, 0), off, 26 * M).run!;
		const s = skip(waiting, off, 30 * M);
		expect(s.ended).toEqual([]);
		expect(s.run).toMatchObject({ phase: 'focus', round: 2, startedAt: null });
		expect(skip(waiting, on, 30 * M).run).toMatchObject({ phase: 'focus', round: 2, startedAt: 30 * M });
	});

	it('skip while paused counts only the time before the pause', () => {
		const r = pause(begin(L, '', null, 0), 10 * M);
		expect(skip(r, on, 40 * M).ended[0]).toMatchObject({ minutes: 10, completed: false });
	});

	it('stop ends the run and reports a partial focus block', () => {
		const s = stop(begin(L, 'x', null, 0), 7 * M);
		expect(s.run).toBeNull();
		expect(s.ended).toEqual([expect.objectContaining({ phase: 'focus', minutes: 7, completed: false })]);
		expect(stop(advance(begin(L, '', null, 0), on, 26 * M).run!, 27 * M).ended[0].phase).toBe('break');
	});

	it('stop on a waiting phase reports nothing', () => {
		const waiting = advance(begin(L, '', null, 0), off, 26 * M).run!;
		expect(stop(waiting, 30 * M)).toEqual({ run: null, ended: [] });
	});

	it('a run keeps the lengths it started with', () => {
		const lengths = { ...L };
		const r = begin(lengths, '', null, 0);
		lengths.focus = 50;
		expect(phaseMs(r)).toBe(25 * M);
	});
});
