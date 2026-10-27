/**
 * The optional task list. A task counts its own finished pomodoros, so
 * trimming the log never resets its progress.
 */
import type { SyncFields } from '#lib/finance/db.ts';

export interface Task extends SyncFields {
	name: string;
	/** Pomodoros you expect it to take, or null for no estimate. */
	estimate: number | null;
	/** Finished pomodoros spent on it. */
	count: number;
	createdAt: number;
	/** null = still open. */
	doneAt: number | null;
}

export function newTask(name: string, estimate: number | null, now: number, id: string = crypto.randomUUID()): Task {
	return { id, updatedAt: now, deleted: false, name: name.trim(), estimate, count: 0, createdAt: now, doneAt: null };
}

/** Open tasks oldest first; done tasks most recently finished first. */
export function splitTasks(tasks: Task[]): { open: Task[]; done: Task[] } {
	const live = tasks.filter((t) => !t.deleted);
	return {
		open: live.filter((t) => t.doneAt === null).sort((a, b) => a.createdAt - b.createdAt),
		done: live.filter((t) => t.doneAt !== null).sort((a, b) => b.doneAt! - a.doneAt!)
	};
}

/** Open tasks for the label field: all of them for a blank query, else those containing it. */
export function suggest(tasks: Task[], query: string, max = 5): Task[] {
	const q = query.trim().toLowerCase();
	return splitTasks(tasks)
		.open.filter((t) => !q || t.name.toLowerCase().includes(q))
		.slice(0, max);
}

export function progress(t: Task): { text: string; over: boolean } {
	if (t.estimate === null) return { text: `${t.count}`, over: false };
	return { text: `${t.count}/${t.estimate}`, over: t.count > t.estimate };
}
