import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusTimer } from './timer.svelte';
import { begin, pause } from './engine';

const M = 60_000;
const L = { focus: 25, break: 5, long: 15, every: 2 };
const on = { autoStart: true, stopAfter: 1 };

let t = 0;
function setup() {
	const store = { saveRun: vi.fn(async () => {}), record: vi.fn(async () => {}) };
	const alerts = { chime: vi.fn(), notify: vi.fn() };
	const timer = new FocusTimer(store, alerts, () => t);
	timer.load(null, on);
	return { store, alerts, timer };
}

describe('FocusTimer', () => {
	beforeEach(() => {
		t = 0;
		vi.useFakeTimers();
	});
	afterEach(() => vi.useRealTimers());

	it('logs a finished focus block, bumps its task, chimes once', () => {
		const { store, alerts, timer } = setup();
		timer.start(L, 'essay', 'task1');
		t = 26 * M;
		timer.sync();
		expect(store.record).toHaveBeenCalledWith([expect.objectContaining({ minutes: 25, completed: true, taskId: 'task1' })], expect.any(Number));
		expect(alerts.chime).toHaveBeenCalledTimes(1);
		expect(alerts.chime).toHaveBeenCalledWith('focus');
		expect(alerts.notify).toHaveBeenCalledWith('focus', 'break', false);
		expect(timer.run).toMatchObject({ phase: 'break' });
		expect(timer.left).toBe(4 * M);
	});

	it('load() catches up silently', () => {
		const { store, alerts, timer } = setup();
		t = 5 * 60 * M;
		timer.load(begin(L, '', null, 0), on);
		expect(timer.run).toBeNull();
		expect(store.record).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ completed: true })]), expect.any(Number));
		expect(store.saveRun).toHaveBeenLastCalledWith(null);
		expect(alerts.chime).not.toHaveBeenCalled();
		expect(alerts.notify).not.toHaveBeenCalled();
	});

	it('load() keeps a paused run paused with the same time left', () => {
		const { timer } = setup();
		t = 60 * M;
		timer.load(pause(begin(L, '', null, 0), 10 * M), on);
		expect(timer.left).toBe(15 * M);
		expect(timer.run?.pausedAt).toBe(10 * M);
	});

	it('skip logs a partial block, no task bump, no chime', () => {
		const { store, alerts, timer } = setup();
		timer.start(L, 'x', 'task1');
		t = 12 * M;
		timer.skip();
		expect(store.record).toHaveBeenCalledWith([expect.objectContaining({ minutes: 12, completed: false })], expect.any(Number));
		expect(alerts.chime).not.toHaveBeenCalled();
	});

	it('setLabel mid-block is what the log row gets', () => {
		const { store, timer } = setup();
		timer.start(L, 'draft', null);
		timer.setLabel('essay', 'task2');
		t = 26 * M;
		timer.sync();
		expect(store.record).toHaveBeenCalledWith([expect.objectContaining({ label: 'essay', taskId: 'task2' })], expect.any(Number));
	});

	it('saves the run on every change and null when it ends', () => {
		const { store, timer } = setup();
		timer.start(L, '', null);
		timer.pause();
		timer.stop();
		expect(store.saveRun).toHaveBeenLastCalledWith(null);
		expect(store.saveRun).toHaveBeenCalledTimes(3);
	});

	it('wakes itself at the phase end so a background tab still alerts', () => {
		const { alerts, timer } = setup();
		timer.start(L, '', null);
		t = 25 * M;
		vi.advanceTimersByTime(25 * M + 100);
		expect(alerts.chime).toHaveBeenCalledWith('focus');
	});

	it('tells the page about logged rows', () => {
		const { timer } = setup();
		const seen = vi.fn();
		timer.onEnded = seen;
		timer.start(L, '', null);
		t = 26 * M;
		timer.sync();
		expect(seen).toHaveBeenCalledWith([expect.objectContaining({ minutes: 25 })]);
	});

	it('a phase that ended long ago (laptop asleep with the page open) is logged but not chimed', () => {
		const { store, alerts, timer } = setup();
		timer.start(L, '', null);
		t = 3 * 60 * M;
		timer.sync();
		expect(timer.run).toBeNull();
		expect(store.record).toHaveBeenCalled();
		expect(alerts.chime).not.toHaveBeenCalled();
		expect(alerts.notify).not.toHaveBeenCalled();
	});

	it('log rows get an id from the block start, so two windows write the same row', () => {
		const { store, timer } = setup();
		timer.start(L, '', null);
		t = 26 * M;
		timer.sync();
		expect(store.record).toHaveBeenCalledWith([expect.objectContaining({ id: 'focus-0' })], 26 * M);
	});

	it("adopt() takes another window's run without saving, logging or alerting", () => {
		const { store, alerts, timer } = setup();
		t = 10 * M;
		timer.adopt(pause(begin(L, '', null, 0), 5 * M));
		expect(timer.run?.pausedAt).toBe(5 * M);
		expect(timer.left).toBe(20 * M);
		expect(store.saveRun).not.toHaveBeenCalled();
		expect(store.record).not.toHaveBeenCalled();
		expect(alerts.chime).not.toHaveBeenCalled();
	});

	it('a block stopped under a minute in is not logged', () => {
		const { store, timer } = setup();
		timer.start(L, '', null);
		t = 30_000;
		timer.stop();
		expect(store.record).not.toHaveBeenCalled();
	});

	it('tells notify when the next phase is waiting for a press', () => {
		const { alerts, timer } = setup();
		timer.load(null, { autoStart: false, stopAfter: 1 });
		timer.start(L, '', null);
		t = 26 * M;
		timer.sync();
		expect(alerts.notify).toHaveBeenCalledWith('focus', 'break', true);
	});
});
