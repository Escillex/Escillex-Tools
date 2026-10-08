/**
 * The part of the screen the phone's keyboard leaves visible.
 *
 * A phone's keyboard covers the page instead of shrinking it, so a screen
 * sized to the whole window centers its content (and its buttons) behind
 * the keyboard. Screens that hold inputs size themselves to this instead.
 *
 * Two sources:
 * - Chrome on Android: the VirtualKeyboard API reports the keyboard's size
 *   the moment it starts opening, so the screen moves along with it. It's
 *   switched on only while a screen tracks (not app-wide: Yellowpad follows
 *   the keyboard its own way, through visualViewport, which this turns off).
 * - Everywhere else (iPhone): visualViewport, which reports only once the
 *   keyboard is fully open. On iPhone the visible part can also be scrolled
 *   down the page (top).
 */
type VirtualKeyboard = EventTarget & { overlaysContent: boolean; boundingRect: DOMRect };

let top = $state(0);
let height = $state<number | null>(null); // null: neither API (old browsers), use the full screen
let users = 0;
let stop = () => {};

function start(): () => void {
	const keyboard = (navigator as Navigator & { virtualKeyboard?: VirtualKeyboard }).virtualKeyboard;
	if (keyboard) {
		keyboard.overlaysContent = true;
		const fit = () => {
			top = 0;
			height = window.innerHeight - keyboard.boundingRect.height;
		};
		fit();
		keyboard.addEventListener('geometrychange', fit);
		addEventListener('resize', fit); // rotation
		return () => {
			keyboard.removeEventListener('geometrychange', fit);
			removeEventListener('resize', fit);
			keyboard.overlaysContent = false;
		};
	}
	const vv = window.visualViewport;
	if (!vv) return () => {};
	const fit = () => {
		top = vv.offsetTop;
		height = vv.height;
	};
	fit();
	vv.addEventListener('resize', fit);
	vv.addEventListener('scroll', fit);
	return () => {
		vv.removeEventListener('resize', fit);
		vv.removeEventListener('scroll', fit);
	};
}

/** Follow the visible area while a screen is open. Call from onMount; returns the cleanup. */
export function trackViewport(): () => void {
	if (users++ === 0) stop = start();
	return () => {
		if (--users > 0) return;
		stop();
		height = null;
		top = 0;
	};
}

export const viewport = {
	get top() {
		return top;
	},
	get height() {
		return height;
	},
	/** The keyboard is taking up a real part of the screen (not just a rounding difference). */
	get keyboardOpen() {
		return height !== null && height > 0 && window.innerHeight - height > 120;
	}
};
