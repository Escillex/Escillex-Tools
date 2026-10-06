import { describe, expect, it } from 'vitest';
import { Doc } from './doc.svelte';

describe('Doc', () => {
	it('starts clean', () => {
		const d = new Doc('a');
		expect(d.text).toBe('a');
		expect(d.dirty).toBe(false);
	});

	it('is dirty after a change and clean after markSaved', () => {
		const d = new Doc('a');
		d.change('b');
		expect(d.dirty).toBe(true);
		d.markSaved();
		expect(d.dirty).toBe(false);
	});

	it('stays dirty when edits happened after the saved snapshot', () => {
		const d = new Doc('a');
		d.change('b');
		const snapshot = d.text;
		d.change('c');
		d.markSaved(snapshot);
		expect(d.dirty).toBe(true);
	});

	it('undoes and redoes', () => {
		const d = new Doc('a');
		d.change('b');
		d.change('c');
		expect(d.undo()).toBe(true);
		expect(d.text).toBe('b');
		expect(d.redo()).toBe(true);
		expect(d.text).toBe('c');
		expect(d.redo()).toBe(false);
	});

	it('clears redo on a new change', () => {
		const d = new Doc('a');
		d.change('b');
		d.undo();
		d.change('x');
		expect(d.redo()).toBe(false);
	});

	it('caps undo at 100 steps', () => {
		const d = new Doc('0');
		for (let i = 1; i <= 150; i++) d.change(String(i));
		let n = 0;
		while (d.undo()) n++;
		expect(n).toBe(100);
		expect(d.text).toBe('50');
	});

	it('load resets history and dirty', () => {
		const d = new Doc('a');
		d.change('b');
		d.load('z');
		expect(d.text).toBe('z');
		expect(d.dirty).toBe(false);
		expect(d.undo()).toBe(false);
	});

	it('ignores a change to the same text', () => {
		const d = new Doc('a');
		d.change('a');
		expect(d.undo()).toBe(false);
	});

	it('keeps raw typing as its own undo step instead of wiping it', () => {
		const d = new Doc('a');
		d.change('a+tick'); // a Read-mode edit
		d.text = 'a+tick+typed'; // typing in Edit mode writes text directly
		expect(d.undo()).toBe(true);
		expect(d.text).toBe('a+tick');
		expect(d.undo()).toBe(true);
		expect(d.text).toBe('a');
		expect(d.redo()).toBe(true);
		expect(d.redo()).toBe(true);
		expect(d.text).toBe('a+tick+typed');
	});

	it('keeps raw typing when a Read-mode edit follows it', () => {
		const d = new Doc('a');
		d.text = 'ab'; // typed
		d.change('ab!'); // then a tick
		d.undo();
		expect(d.text).toBe('ab');
	});
});
