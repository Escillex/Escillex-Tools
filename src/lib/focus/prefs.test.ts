import { describe, expect, it } from 'vitest';
import { cleanKeep, cleanRules, cleanRun } from './prefs';
import { begin } from './engine';

const L = { focus: 25, break: 5, long: 15, every: 4 };

describe('focus prefs', () => {
	it('cleanRules: defaults for anything missing or wrong', () => {
		expect(cleanRules(undefined)).toEqual({ autoStart: true, stopAfter: 1 });
		expect(cleanRules({ autoStart: false, stopAfter: 3 })).toEqual({ autoStart: false, stopAfter: 3 });
		expect(cleanRules({ autoStart: 'yes', stopAfter: 7 })).toEqual({ autoStart: true, stopAfter: 1 });
		expect(cleanRules({ stopAfter: 0 }).stopAfter).toBe(0);
	});

	it('cleanKeep: month unless a known option', () => {
		expect(cleanKeep('year')).toBe('year');
		expect(cleanKeep('decade')).toBe('month');
	});

	it('cleanRun: keeps a valid run, drops a broken one', () => {
		const run = begin(L, 'x', null, 1000);
		expect(cleanRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
		expect(cleanRun({ ...run, phase: 'nap' })).toBeNull();
		expect(cleanRun({ ...run, lengths: { focus: 25 } })).toBeNull();
		expect(cleanRun({ ...run, startedAt: 'soon' })).toBeNull();
		expect(cleanRun(null)).toBeNull();
	});

	it('cleanRun: a missing label/taskId becomes empty rather than dropping the run', () => {
		const run = begin(L, 'x', 't', 1000);
		const rest: Record<string, unknown> = { ...run };
		delete rest.label;
		delete rest.taskId;
		expect(cleanRun(rest)).toMatchObject({ label: '', taskId: null });
	});

	it('cleanKeep: ignores prototype keys', () => {
		expect(cleanKeep('toString')).toBe('month');
		expect(cleanKeep('constructor')).toBe('month');
	});
});
