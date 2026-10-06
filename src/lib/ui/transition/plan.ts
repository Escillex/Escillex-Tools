/**
 * What the page curtain plays for one navigation (see Curtain.svelte).
 *
 * Forward (into a deeper path): bands slam in, a title card stamps the
 * tool's name if we're entering a tool, then the cover cracks open.
 * Back: bands and crack, mirrored, no card. Same depth: the short version.
 * Nothing plays with reduced motion or after an iOS swipe-back (the
 * browser already animated that one).
 */
export type Dir = 'forward' | 'back' | 'same';

/** Set by the launcher right before it navigates: the card to stamp, and whether its slab is flying off first. */
export interface Launch {
	title: string;
	number: string;
	line?: string | null;
	fling?: boolean;
	/** performance.now() when the slab's fling started. */
	at?: number;
}

export interface Plan {
	dir: Dir;
	card: Launch | null;
	/** Bands wait this long (the slab's fling plays first). */
	bandsDelay: number;
	/** When the title card stamps. */
	cardAt: number;
	/** From start until the screen is fully covered and the page can swap. */
	coverMs: number;
	/** How long the crack-open takes. */
	revealMs: number;
}

export const FLING_MS = 110;
export const BANDS_MS = 190;
export const CARD_MS = 120;
export const REVEAL_FORWARD_MS = 240;
export const REVEAL_SHORT_MS = 200;

export const depth = (path = '/') => path.split('/').filter(Boolean).length;

export function direction(from = '/', to = '/'): Dir {
	const a = depth(from);
	const b = depth(to);
	return b > a ? 'forward' : b < a ? 'back' : 'same';
}

export const toolNumber = (index: number) => String(index + 1).padStart(2, '0');

export function planFor(o: {
	from?: string;
	to?: string;
	launch: Launch | null;
	tools: { name: string; href: string }[];
	reduced: boolean;
	uaAnimated: boolean;
	/** performance.now() at this navigation; the fling may already be over by then. */
	now?: number;
}): Plan | null {
	if (o.reduced || o.uaAnimated || !o.to || o.from === o.to) return null;
	const dir = direction(o.from, o.to);
	const launch = dir === 'forward' ? o.launch : null;
	let card: Launch | null = launch;
	if (dir === 'forward' && !card) {
		const i = o.tools.findIndex((t) => t.href === o.to);
		if (i >= 0) card = { title: o.tools[i].name, number: toolNumber(i) };
	}
	// onNavigate runs after the page has loaded, so only wait out what's left of the fling.
	const flown = launch?.at !== undefined && o.now !== undefined ? o.now - launch.at : 0;
	const bandsDelay = launch?.fling ? Math.max(0, FLING_MS - flown) : 0;
	const cardAt = bandsDelay + BANDS_MS;
	return {
		dir,
		card,
		bandsDelay,
		cardAt,
		coverMs: cardAt + (card ? CARD_MS : 0),
		revealMs: card ? REVEAL_FORWARD_MS : REVEAL_SHORT_MS
	};
}
