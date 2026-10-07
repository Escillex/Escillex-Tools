/**
 * When to save. Manual: only on Ctrl+S / the SAVE button. Auto: one
 * second after the last edit (and when the window loses focus). Writes
 * never overlap: asking to save during a write queues one more write
 * afterwards, which picks up whatever was typed meanwhile.
 *
 * The actual write is passed in, so this can be tested without files.
 */
import { untrack } from 'svelte';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed';

export class Saver {
	status = $state<SaveStatus>('idle');
	auto = $state(false);

	#write: () => Promise<void>;
	#isDirty: () => boolean;
	#delay: number;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#running: Promise<void> | null = null;
	#again = false;

	constructor(write: () => Promise<void>, isDirty: () => boolean, delay = 1000) {
		this.#write = write;
		this.#isDirty = isDirty;
		this.#delay = delay;
	}

	get pending(): boolean {
		return this.status === 'dirty' || this.status === 'saving' || this.status === 'failed';
	}

	edited(): void {
		if (this.status !== 'saving') this.status = this.#isDirty() ? 'dirty' : 'saved';
		if (this.auto) this.#schedule();
	}

	setAuto(on: boolean): void {
		this.auto = on;
		clearTimeout(this.#timer);
		if (on && this.#isDirty()) this.#schedule();
	}

	save(): Promise<void> {
		clearTimeout(this.#timer);
		if (this.#running) {
			this.#again = true;
			return this.#running;
		}
		if (!this.#isDirty()) return Promise.resolve();
		this.#running = this.#loop().finally(() => (this.#running = null));
		return this.#running;
	}

	dispose(): void {
		clearTimeout(this.#timer);
	}

	#schedule() {
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.save(), this.#delay);
	}

	async #loop() {
		do {
			this.#again = false;
			this.status = 'saving';
			try {
				await this.#write();
			} catch {
				this.status = 'failed';
				return;
			}
		} while (this.#again && this.#isDirty());
		this.status = this.#isDirty() ? 'dirty' : 'saved';
	}
}

/**
 * Tell the saver about every change to the text, while `active()` (a file is open). Call from a component's setup.
 * edited() reads the saver's own status; untracked, or a failed save would re-run this and be overwritten with 'dirty'.
 */
export function watchEdits(read: () => unknown, saver: Saver, active: () => boolean): void {
	$effect(() => {
		read();
		if (active()) untrack(() => saver.edited());
	});
}
