/**
 * The running timer while FOCUS is open: the engine's rules plus the
 * clock, the database and the alerts. The page calls sync() every second
 * and when it comes back into view; a timeout to the phase end covers a
 * background tab. Alerts only come from sync(): a skip or stop was your
 * own press, and load() is catching up on phases that ended while closed.
 */
import { advance, begin, pause, remaining, resume, skip, stop, type Phase, type Rules, type Run, type Step } from './engine';
import { DEFAULT_RULES } from './prefs';
import { rowFrom, type LogRow } from './log';
import type { Lengths } from './presets';

export interface TimerStore {
	saveRun(r: Run | null): Promise<unknown>;
	/** Write the log rows and count finished ones toward their tasks. */
	record(rows: LogRow[], now: number): Promise<unknown>;
}

export interface TimerAlerts {
	chime(p: Phase): void;
	/** waiting: the next phase needs a press (auto-start off). */
	notify(p: Phase, next: Phase | null, waiting: boolean): void;
}

/**
 * A phase that ended longer ago than this is old news (the laptop slept with
 * the page open): logged, but not chimed. Wider than a minute because
 * browsers run a hidden tab's timers only about once a minute.
 */
export const STALE_MS = 90_000;

export class FocusTimer {
	run = $state<Run | null>(null);
	/** ms left in the current phase. */
	left = $state(0);
	rules = $state<Rules>({ ...DEFAULT_RULES });
	/** Called with the log rows written, so the page can update its Today panel and tasks. */
	onEnded: ((rows: LogRow[]) => void) | null = null;

	#store: TimerStore;
	#alerts: TimerAlerts;
	#now: () => number;
	#wake: ReturnType<typeof setTimeout> | null = null;

	constructor(store: TimerStore, alerts: TimerAlerts, now: () => number = Date.now) {
		this.#store = store;
		this.#alerts = alerts;
		this.#now = now;
	}

	/** The saved run from last time, caught up silently. */
	load(run: Run | null, rules: Rules) {
		this.rules = rules;
		if (!run) {
			this.#set(null, false);
			return;
		}
		const step = advance(run, rules, this.#now());
		this.#apply(step, step.ended.length > 0, false);
	}

	start(lengths: Lengths, label: string, taskId: string | null) {
		this.#set(begin(lengths, label, taskId, this.#now()));
	}

	pause() {
		if (this.run) this.#set(pause(this.run, this.#now()));
	}

	resume() {
		if (this.run) this.#set(resume(this.run, this.#now()));
	}

	skip() {
		if (this.run) this.#apply(skip(this.run, this.rules, this.#now()), true, false);
	}

	stop() {
		if (this.run) this.#apply(stop(this.run, this.#now()), true, false);
	}

	/** Change what this block is for. The log row takes whatever is set when the block ends. */
	setLabel(label: string, taskId: string | null) {
		if (this.run) this.#set({ ...this.run, label, taskId });
	}

	/** Another window changed the run: show it, without saving, logging or alerting (that window did). */
	adopt(run: Run | null) {
		this.#set(run, false);
	}

	/** Re-check the clock: anything that ended since the last check gets logged and one alert. */
	sync() {
		if (!this.run) return;
		const step = advance(this.run, this.rules, this.#now());
		if (step.ended.length) this.#apply(step, true, true);
		else this.#tick();
	}

	dispose() {
		if (this.#wake) clearTimeout(this.#wake);
	}

	#apply(step: Step, save: boolean, loud: boolean) {
		const now = this.#now();
		// A block stopped in its first minute (a mis-tap) isn't worth a row.
		const rows = step.ended.filter((e) => e.phase === 'focus' && (e.completed || e.minutes > 0)).map((e) => rowFrom(e, now));
		if (rows.length) {
			this.#store.record(rows, now);
			this.onEnded?.(rows);
		}
		this.#set(step.run, save);
		const last = step.ended.at(-1);
		if (loud && last && now - last.end < STALE_MS) {
			this.#alerts.chime(last.phase);
			this.#alerts.notify(last.phase, step.run?.phase ?? null, step.run?.startedAt === null);
		}
	}

	#set(run: Run | null, save = true) {
		this.run = run;
		if (save) this.#store.saveRun(run ? $state.snapshot(run) : null);
		this.#tick();
	}

	#tick() {
		this.left = this.run ? remaining(this.run, this.#now()) : 0;
		if (this.#wake) clearTimeout(this.#wake);
		this.#wake = null;
		const r = this.run;
		if (r && r.startedAt !== null && r.pausedAt === null) this.#wake = setTimeout(() => this.sync(), this.left + 50);
	}
}
