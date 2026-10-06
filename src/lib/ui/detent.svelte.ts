/**
 * Detent physics for the wheels (WalletLoop, the launcher dial).
 *
 * `pos` is a position on an endless number line; each whole number is a
 * notch. Dragging sets it directly, letting go throws it with the drag's
 * speed and settles on a notch, and onNotch fires each time the nearest
 * notch changes (that's where the tick goes).
 */
type Raf = (cb: (now: number) => void) => number;

export interface DetentOptions {
	onNotch: (rounded: number) => void;
	/** Injected in tests; the browser's animation frames otherwise. */
	raf?: Raf;
	caf?: (id: number) => void;
	now?: () => number;
}

/** How long a release keeps its speed before settling, in ms. */
export const THROW_MS = 280;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const settleDuration = (distance: number) => Math.min(900, 260 + Math.abs(distance) * 70);

export class Detent {
	pos = $state(0);
	#last: number;
	#frame = 0;
	#samples: { t: number; pos: number }[] = [];
	#o: Required<DetentOptions>;

	constructor(start: number, opts: DetentOptions) {
		this.pos = start;
		this.#last = Math.round(start);
		this.#o = {
			raf: (cb) => requestAnimationFrame(cb),
			caf: (id) => cancelAnimationFrame(id),
			now: () => performance.now(),
			...opts
		};
	}

	get rounded() {
		return Math.round(this.pos);
	}

	/** Finger down: stop any animation and start recording speed. */
	grab() {
		this.stop();
		this.#samples = [{ t: this.#o.now(), pos: this.pos }];
	}

	/** Move to an exact position (a drag or the wheel). */
	moveTo(pos: number) {
		this.pos = pos;
		this.#samples.push({ t: this.#o.now(), pos });
		if (this.#samples.length > 6) this.#samples.shift();
		this.#notch();
	}

	/** Finger up: keep the drag's speed for a moment, then settle on a notch. */
	release() {
		const first = this.#samples[0];
		const last = this.#samples[this.#samples.length - 1];
		if (!first || !last) return this.animateTo(this.rounded);
		const velocity = (last.pos - first.pos) / Math.max(1, last.t - first.t); // notches per ms
		this.animateTo(Math.round(this.pos + velocity * THROW_MS));
	}

	animateTo(target: number, done?: () => void) {
		this.stop();
		const from = this.pos;
		const distance = target - from;
		const duration = settleDuration(distance);
		let start = -1;
		const step = (now: number) => {
			if (start < 0) start = now;
			const t = Math.min(1, (now - start) / duration);
			this.pos = t === 1 ? target : from + distance * easeOutCubic(t);
			this.#notch();
			if (t < 1) this.#frame = this.#o.raf(step);
			else done?.();
		};
		this.#frame = this.#o.raf(step);
	}

	/** Set the position without a tick (the selection was changed from outside). */
	jump(pos: number) {
		this.stop();
		this.pos = pos;
		this.#last = Math.round(pos);
	}

	stop() {
		this.#o.caf(this.#frame);
	}

	#notch() {
		const r = Math.round(this.pos);
		if (r !== this.#last) {
			this.#last = r;
			this.#o.onNotch(r);
		}
	}
}
