/**
 * The launcher dial's geometry, kept free of the DOM so it can be tested.
 *
 * The dial is a big circle centred off the left edge of the screen; only
 * a sliver (EDGE px) shows. Tools stand on its rim like spokes, STEP_DEG
 * apart, and the one at 3 o'clock is under the pointer slab. Angles are
 * in degrees: 0 = 3 o'clock, positive = clockwise (down the screen).
 */
export const STEP_DEG = 19;
export const EDGE = 60;
/** Pull the slab this far (fraction of the width) and letting go opens the tool. */
export const PULL_THRESHOLD = 0.35;
/** A drag decides between turning and pulling after this many px. */
export const LOCK_PX = 8;
/** A tap pulls the slab out by itself, this fast. */
export const AUTO_PULL_MS = 180;

export interface Geometry {
	cx: number;
	cy: number;
	r: number;
}

/** What the dial shows for one tool. */
export interface DialTool {
	id: string;
	name: string;
	href: string;
	line: string | null;
}

export const wrap = (i: number, n: number) => (n <= 0 ? 0 : ((i % n) + n) % n);

/**
 * How much to shrink the slab's name so it fits beside the chevrons:
 * 1 when it already fits, less for long names (Yellowpad on a phone).
 * 1 until both widths are measured.
 */
export const fitScale = (available: number, natural: number) => (available > 0 && natural > available ? available / natural : 1);

export function geometry(w: number, h: number): Geometry {
	const r = Math.max(310, Math.round(h * 0.42));
	return { r, cx: EDGE - r, cy: Math.round(h / 2) };
}

export function angleAt(x: number, y: number, g: Geometry): number {
	return (Math.atan2(y - g.cy, x - g.cx) * 180) / Math.PI;
}

/** Spoke size by distance (notches) from 3 o'clock; in between is a straight blend. */
const SIZES: [number, number][] = [
	[1, 1],
	[2, 0.73],
	[3, 0.56],
	[4, 0.45]
];

export function spoke(d: number): { scale: number; tone: 'ink' | 'dim' | 'faint'; opacity: number } {
	const a = Math.abs(d);
	let scale = 1;
	for (let i = 0; i < SIZES.length - 1; i++) {
		const [d0, s0] = SIZES[i];
		const [d1, s1] = SIZES[i + 1];
		if (a >= d0 && a <= d1) scale = s0 + ((a - d0) / (d1 - d0)) * (s1 - s0);
	}
	if (a > 4) scale = 0.45;
	scale = Math.round(scale * 100) / 100;
	const tone = a < 1.5 ? 'ink' : a < 2.5 ? 'dim' : 'faint';
	const opacity = a < 0.5 ? 0 : a < 1 ? (a - 0.5) * 2 : a > 4 ? Math.max(0, 1 - (a - 4) * 2) : 1;
	return { scale, tone, opacity };
}

/** The tick ring: four ticks per notch, turning with the dial, within ±80°. */
export function ticks(pos: number): { k: number; angle: number; major: boolean }[] {
	const out = [];
	const span = 80 / STEP_DEG;
	for (let k = Math.ceil((pos - span) * 4); k <= Math.floor((pos + span) * 4); k++) {
		const angle = (k / 4 - pos) * STEP_DEG;
		if (Math.abs(angle) <= 80) out.push({ k, angle, major: k % 4 === 0 });
	}
	return out;
}

export function lockDirection(dx: number, dy: number, onSlab: boolean): 'turn' | 'pull' | null {
	if (Math.hypot(dx, dy) < LOCK_PX) return null;
	return onSlab && dx > 0 && Math.abs(dx) > Math.abs(dy) ? 'pull' : 'turn';
}

/** The slab's offset for a finger offset: heavier the further it goes, and stiff to the left. */
export function rubber(dx: number, w: number): number {
	if (dx <= 0) return dx * 0.2;
	const max = w * 0.6;
	return max * (1 - Math.exp(-dx / max));
}

export const pulledPast = (offset: number, w: number) => offset >= w * PULL_THRESHOLD;

/** What letting go (or a cancelled pointer) does. A cancel never opens anything. */
export function releaseAction(mode: 'turn' | 'pull' | null, past: boolean, cancelled: boolean): 'launch' | 'snap' | 'throw' | 'settle' | 'tap' {
	if (mode === 'pull') return past && !cancelled ? 'launch' : 'snap';
	if (mode === 'turn') return cancelled ? 'settle' : 'throw';
	return cancelled ? 'settle' : 'tap';
}

/** Only the first finger drives the dial; another is ignored until it lifts. */
export class PointerOwner {
	#id: number | null = null;
	take(id: number) {
		if (this.#id !== null) return false;
		this.#id = id;
		return true;
	}
	owns(id: number) {
		return this.#id === id;
	}
	release(id: number) {
		if (this.#id !== id) return false;
		this.#id = null;
		return true;
	}
}

/** A launch happens once: a second tap or finger can't start another. */
export class Once {
	#done = false;
	claim() {
		if (this.#done) return false;
		this.#done = true;
		return true;
	}
}
