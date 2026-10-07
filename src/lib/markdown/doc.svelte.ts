/**
 * One open document: its Markdown, whether it differs from what was last
 * saved, and undo for edits made in Read mode (table cells, checkboxes).
 * Typing in the raw editor uses the textarea's own undo instead.
 *
 * It doesn't know where the text lives; Yellowpad saves it to a file,
 * Notes (later) to the database.
 */
const MAX_UNDO = 100;

export class Doc {
	text = $state('');
	#saved = $state('');
	#undo: string[] = [];
	#redo: string[] = [];
	/** The text right after this Doc's own last step. If text differs, it was typed in the raw editor. */
	#last = '';

	constructor(text = '') {
		this.text = text;
		this.#saved = text;
		this.#last = text;
	}

	/** Typing since our last step becomes its own undo step, so undoing a tick can't wipe it. */
	#keepTyping() {
		if (this.text === this.#last) return;
		this.#push(this.#last);
		this.#redo = [];
		this.#last = this.text;
	}

	#push(text: string) {
		this.#undo.push(text);
		if (this.#undo.length > MAX_UNDO) this.#undo.shift();
	}

	get dirty(): boolean {
		return this.text !== this.#saved;
	}

	change(next: string): void {
		this.#keepTyping();
		if (next === this.text) return;
		this.#push(this.text);
		this.#redo = [];
		this.text = this.#last = next;
	}

	undo(): boolean {
		this.#keepTyping();
		const prev = this.#undo.pop();
		if (prev === undefined) return false;
		this.#redo.push(this.text);
		this.text = this.#last = prev;
		return true;
	}

	redo(): boolean {
		this.#keepTyping();
		const next = this.#redo.pop();
		if (next === undefined) return false;
		this.#push(this.text);
		this.text = this.#last = next;
		return true;
	}

	load(text: string): void {
		this.text = this.#last = text;
		this.#saved = text;
		this.#undo = [];
		this.#redo = [];
	}

	markSaved(text: string = this.text): void {
		this.#saved = text;
	}
}
