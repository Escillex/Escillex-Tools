/**
 * How full the sync progress bar is, 0–100.
 *
 * Every step after "searching" takes about a second, so those just jump.
 * Searching can take a while, so the bar creeps from 10% toward 40% and
 * slows down as it goes: it always looks alive, but never claims to be
 * further along than it is. Finding the other device jumps it past 40%.
 */

export type ProgressStep = 'connecting' | 'searching' | 'sending' | 'receiving' | 'comparing';

/** Creep speed: about two thirds of the way to 40% after this long. */
const CREEP_MS = 20_000;

export const searchProgress = (elapsedMs: number): number => 10 + 30 * (1 - Math.exp(-elapsedMs / CREEP_MS));

const FIXED: Record<Exclude<ProgressStep, 'searching'>, number> = {
	connecting: 5,
	sending: 50,
	receiving: 70,
	comparing: 90
};

export function progressFor(step: ProgressStep, elapsedMs: number): number {
	return step === 'searching' ? searchProgress(elapsedMs) : FIXED[step];
}
