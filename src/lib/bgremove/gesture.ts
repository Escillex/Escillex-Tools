/** Hold a thumbnail, then swipe: up deletes, down downloads (DOWN-load). */
export const HOLD_MS = 450;
/** Moving further than this before the hold fires means it was a drag, not a hold. */
export const HOLD_TOLERANCE = 6;
export const SWIPE_PX = 48;

export function swipeAction(dy: number): 'delete' | 'download' | null {
	if (dy <= -SWIPE_PX) return 'delete';
	if (dy >= SWIPE_PX) return 'download';
	return null;
}
