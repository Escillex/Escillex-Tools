/**
 * Hold-then-swipe for grid tiles (touch and pen; mice use hover buttons).
 * Once the hold fires, the grid stops scrolling so the swipe goes to the tile,
 * and the click that follows the release is swallowed.
 */
import { HOLD_MS, HOLD_TOLERANCE } from './gesture';

interface HoldOptions {
	onhold: () => void;
	onmove: (dy: number) => void;
	onend: (dy: number) => void;
}

export function holdable(node: HTMLElement, options: HoldOptions) {
	let opts = options;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let holding = false;
	let swallowClick = false;
	let x0 = 0;
	let y0 = 0;

	const down = (e: PointerEvent) => {
		if (e.pointerType === 'mouse') return;
		x0 = e.clientX;
		y0 = e.clientY;
		timer = setTimeout(() => {
			holding = true;
			node.setPointerCapture(e.pointerId);
			opts.onhold();
		}, HOLD_MS);
	};
	const move = (e: PointerEvent) => {
		if (holding) return opts.onmove(e.clientY - y0);
		if (Math.hypot(e.clientX - x0, e.clientY - y0) > HOLD_TOLERANCE) clearTimeout(timer);
	};
	const up = (e: PointerEvent) => {
		clearTimeout(timer);
		if (!holding) return;
		holding = false;
		swallowClick = true;
		opts.onend(e.clientY - y0);
	};
	// Touch scrolling can't be switched off mid-gesture with CSS; cancelling touchmove can.
	const touchmove = (e: TouchEvent) => holding && e.preventDefault();
	const click = (e: MouseEvent) => {
		if (!swallowClick) return;
		swallowClick = false;
		e.stopImmediatePropagation();
		e.preventDefault();
	};
	const menu = (e: Event) => e.preventDefault(); // long-press would open the image menu

	node.addEventListener('pointerdown', down);
	node.addEventListener('pointermove', move);
	node.addEventListener('pointerup', up);
	node.addEventListener('pointercancel', up);
	node.addEventListener('touchmove', touchmove, { passive: false });
	node.addEventListener('click', click, true);
	node.addEventListener('contextmenu', menu);
	return {
		update(o: HoldOptions) {
			opts = o;
		},
		destroy() {
			clearTimeout(timer);
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', up);
			node.removeEventListener('pointercancel', up);
			node.removeEventListener('touchmove', touchmove);
			node.removeEventListener('click', click, true);
			node.removeEventListener('contextmenu', menu);
		}
	};
}
