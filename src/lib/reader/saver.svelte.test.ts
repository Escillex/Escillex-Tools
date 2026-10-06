import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { Saver, watchEdits } from './saver.svelte';

function setup(opts: { fail?: boolean } = {}) {
	let text = 'a';
	let saved = 'a';
	const writes: string[] = [];
	let release: () => void = () => {};
	let hold = false;
	const write = vi.fn(async () => {
		const snapshot = text;
		if (hold) await new Promise<void>((r) => (release = r));
		if (opts.fail) throw new Error('disk full');
		writes.push(snapshot);
		saved = snapshot;
	});
	const saver = new Saver(write, () => text !== saved);
	return {
		saver,
		write,
		writes,
		edit(next: string) {
			text = next;
			saver.edited();
		},
		holdWrites() {
			hold = true;
		},
		release: () => release()
	};
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Saver, manual', () => {
	it('only writes when asked', async () => {
		const s = setup();
		s.edit('b');
		expect(s.saver.status).toBe('dirty');
		await vi.advanceTimersByTimeAsync(5000);
		expect(s.write).not.toHaveBeenCalled();
		await s.saver.save();
		expect(s.writes).toEqual(['b']);
		expect(s.saver.status).toBe('saved');
	});

	it('does nothing when there is nothing to save', async () => {
		const s = setup();
		await s.saver.save();
		expect(s.write).not.toHaveBeenCalled();
	});
});

describe('Saver, auto', () => {
	it('writes 1s after the last edit, and edits push it back', async () => {
		const s = setup();
		s.saver.setAuto(true);
		s.edit('b');
		await vi.advanceTimersByTimeAsync(800);
		s.edit('c');
		await vi.advanceTimersByTimeAsync(800);
		expect(s.write).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(200);
		expect(s.writes).toEqual(['c']);
	});

	it('turning auto on with unsaved work schedules a save', async () => {
		const s = setup();
		s.edit('b');
		s.saver.setAuto(true);
		await vi.advanceTimersByTimeAsync(1000);
		expect(s.writes).toEqual(['b']);
	});

	it('stops scheduling after dispose', async () => {
		const s = setup();
		s.saver.setAuto(true);
		s.edit('b');
		s.saver.dispose();
		await vi.advanceTimersByTimeAsync(5000);
		expect(s.write).not.toHaveBeenCalled();
	});
});

describe('Saver, overlapping and failing', () => {
	it('queues one more write when asked to save during a write', async () => {
		const s = setup();
		s.holdWrites();
		s.edit('b');
		const first = s.saver.save();
		s.edit('c');
		const second = s.saver.save();
		expect(s.write).toHaveBeenCalledTimes(1);
		s.release();
		await vi.waitFor(() => expect(s.write).toHaveBeenCalledTimes(2));
		s.release();
		await Promise.all([first, second]);
		expect(s.writes).toEqual(['b', 'c']);
		expect(s.saver.status).toBe('saved');
	});

	it('is dirty again when edits happened during the write', async () => {
		const s = setup();
		s.holdWrites();
		s.edit('b');
		const p = s.saver.save();
		s.edit('c'); // no save() call this time
		s.release();
		await p;
		expect(s.saver.status).toBe('dirty');
	});

	it('goes to failed and keeps the work unsaved', async () => {
		const s = setup({ fail: true });
		s.edit('b');
		await s.saver.save();
		expect(s.saver.status).toBe('failed');
		expect(s.saver.pending).toBe(true);
	});
});

describe('watchEdits', () => {
	it('leaves a failed save showing as failed (so Retry appears) and stops retrying', async () => {
		const doc = $state({ text: 'a' });
		let saved = 'a';
		const write = vi.fn(async () => {
			throw new Error('denied');
		});
		const saver = new Saver(write, () => doc.text !== saved);
		saver.setAuto(true);
		const stop = $effect.root(() => watchEdits(() => doc.text, saver, () => true));
		flushSync();
		doc.text = 'b';
		flushSync();
		await vi.advanceTimersByTimeAsync(1000);
		flushSync();
		expect(saver.status).toBe('failed');
		await vi.advanceTimersByTimeAsync(5000);
		expect(write).toHaveBeenCalledTimes(1);
		stop();
	});
});
