import { describe, expect, it } from 'vitest';
import { newTask, progress, splitTasks, suggest, type Task } from './tasks';

const t = (over: Partial<Task>): Task => ({ ...newTask('x', null, 0, over.id ?? 'id'), ...over });

describe('tasks', () => {
	it('splits open and done, dropping tombstones', () => {
		const r = splitTasks([t({ id: 'a', createdAt: 2 }), t({ id: 'b', createdAt: 1 }), t({ id: 'c', doneAt: 5 }), t({ id: 'd', doneAt: 9 }), t({ id: 'e', deleted: true })]);
		expect(r.open.map((x) => x.id)).toEqual(['b', 'a']);
		expect(r.done.map((x) => x.id)).toEqual(['d', 'c']);
	});

	it('suggests open tasks matching the query, case-insensitive', () => {
		const list = [t({ id: '1', name: 'Write essay' }), t({ id: '2', name: 'Taxes' }), t({ id: '3', name: 'Essay notes', doneAt: 1 })];
		expect(suggest(list, 'ESS').map((x) => x.id)).toEqual(['1']);
		expect(suggest(list, '  ').map((x) => x.id)).toEqual(['1', '2']);
	});

	it('progress text and overrun', () => {
		expect(progress(t({ count: 3, estimate: 4 }))).toEqual({ text: '3/4', over: false });
		expect(progress(t({ count: 5, estimate: 4 }))).toEqual({ text: '5/4', over: true });
		expect(progress(t({ count: 3, estimate: null }))).toEqual({ text: '3', over: false });
	});

	it('newTask trims the name and starts at zero', () => {
		expect(newTask('  Taxes ', 4, 7, 'n')).toEqual({ id: 'n', updatedAt: 7, deleted: false, name: 'Taxes', estimate: 4, count: 0, createdAt: 7, doneAt: null });
	});
});
