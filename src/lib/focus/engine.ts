/**
 * The timer's rules, as pure functions of a saved run and the time now.
 * A run is stored as timestamps (when the phase started, how long it has
 * been paused), never as a ticking counter, so it survives reloads and
 * closed tabs: whoever opens it next asks advance() what has ended since.
 */
import type { Lengths } from './presets';

export type Phase = 'focus' | 'break' | 'long';

/** autoStart: each phase starts the next by itself. stopAfter: cycles before it stops (0 = never). */
export interface Rules {
	autoStart: boolean;
	stopAfter: number;
}

export interface Run {
	/** Copied from the preset at start, so editing the preset never changes a running timer. */
	lengths: Lengths;
	phase: Phase;
	/** Which focus block of the cycle, 1..every. */
	round: number;
	cycle: number;
	/** null = waiting for a press. */
	startedAt: number | null;
	pausedAt: number | null;
	pausedMs: number;
	label: string;
	taskId: string | null;
}

/** A phase that's over. minutes = whole minutes it actually ran, pauses left out. */
export interface Ended {
	phase: Phase;
	start: number;
	end: number;
	minutes: number;
	completed: boolean;
	label: string;
	taskId: string | null;
}

export interface Step {
	run: Run | null;
	ended: Ended[];
}

const MINUTE = 60_000;

export function begin(lengths: Lengths, label: string, taskId: string | null, now: number): Run {
	// Only the four lengths: a whole Preset can be passed in, and its name/id don't belong in the run.
	const { focus, break: rest, long, every } = lengths;
	return { lengths: { focus, break: rest, long, every }, phase: 'focus', round: 1, cycle: 1, startedAt: now, pausedAt: null, pausedMs: 0, label, taskId };
}

export function phaseMs(run: Run): number {
	return run.lengths[run.phase] * MINUTE;
}

function elapsed(run: Run, now: number): number {
	if (run.startedAt === null) return 0;
	return (run.pausedAt ?? now) - run.startedAt - run.pausedMs;
}

export function remaining(run: Run, now: number): number {
	return Math.max(0, phaseMs(run) - elapsed(run, now));
}

/** The phase after this one, starting at `at` (or waiting), or null when the last allowed cycle is done. */
function next(run: Run, rules: Rules, at: number): Run | null {
	const { every } = run.lengths;
	let { phase, round, cycle } = run;
	if (phase === 'focus') phase = round < every ? 'break' : 'long';
	else if (phase === 'break') [phase, round] = ['focus', round + 1];
	else {
		if (rules.stopAfter > 0 && cycle >= rules.stopAfter) return null;
		[phase, round, cycle] = ['focus', 1, cycle + 1];
	}
	return { ...run, phase, round, cycle, startedAt: rules.autoStart ? at : null, pausedAt: null, pausedMs: 0 };
}

function ended(run: Run, end: number, ms: number, completed: boolean): Ended {
	return { phase: run.phase, start: run.startedAt!, end, minutes: Math.floor(ms / MINUTE), completed, label: run.label, taskId: run.taskId };
}

/** Every phase that has run out by `now`, and what's running after them. */
export function advance(run: Run, rules: Rules, now: number): Step {
	const out: Ended[] = [];
	let r: Run | null = run;
	while (r && r.startedAt !== null && r.pausedAt === null && elapsed(r, now) >= phaseMs(r)) {
		const end: number = r.startedAt + r.pausedMs + phaseMs(r);
		out.push(ended(r, end, phaseMs(r), true));
		r = next(r, rules, end);
	}
	return { run: r, ended: out };
}

export function pause(run: Run, now: number): Run {
	if (run.startedAt === null || run.pausedAt !== null) return run;
	return { ...run, pausedAt: now };
}

/** Resumes a pause, or starts a phase that was waiting for a press. */
export function resume(run: Run, now: number): Run {
	if (run.startedAt === null) return { ...run, startedAt: now };
	if (run.pausedAt === null) return run;
	return { ...run, pausedAt: null, pausedMs: run.pausedMs + now - run.pausedAt };
}

/** End this phase now and move on. A phase that already ran out counts as finished, not skipped. */
export function skip(run: Run, rules: Rules, now: number): Step {
	const caught = advance(run, rules, now);
	if (caught.ended.length || !caught.run) return caught;
	const r = caught.run;
	if (r.startedAt === null) return { run: next(r, rules, now), ended: [] };
	return { run: next(r, rules, now), ended: [ended(r, now, elapsed(r, now), false)] };
}

/** End the run. A phase cut short is reported (unfinished); a waiting one isn't. */
export function stop(run: Run, now: number): Step {
	// stop() has no rules: credit a phase that already ran out, but don't invent a started one after it.
	const caught = advance(run, { autoStart: false, stopAfter: 0 }, now);
	const r = caught.run;
	if (!r || r.startedAt === null) return { run: null, ended: caught.ended };
	return { run: null, ended: [...caught.ended, ended(r, now, elapsed(r, now), false)] };
}
