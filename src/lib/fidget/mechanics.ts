/** The small bits of maths behind the toys, kept out of the components so they can be tested. */

/** A bubble sheet: true = popped. */
export const newSheet = (size: number): boolean[] => Array.from({ length: size }, () => false);
export const allPopped = (sheet: boolean[]) => sheet.every(Boolean);

/**
 * How far a finger turned the dial between two angles (radians, from
 * Math.atan2), in turns. atan2 jumps from +π to −π at the left edge, so
 * take the shortest way round: that keeps a slow drag across the seam a
 * small step instead of a whole extra turn.
 */
export function turnDelta(a: number, b: number): number {
	let d = (b - a) / (2 * Math.PI);
	d -= Math.round(d);
	return d;
}

/** The slider's nearest notch (0 … notches−1) for a 0..1 position. Drags past the ends clamp. */
export const notchAt = (fraction: number, notches: number) => Math.round(Math.min(1, Math.max(0, fraction)) * (notches - 1));

/** The first and last notch get the heavy thunk. */
export const isEnd = (notch: number, notches: number) => notch === 0 || notch === notches - 1;
