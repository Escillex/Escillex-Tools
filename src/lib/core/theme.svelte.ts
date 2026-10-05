/**
 * The app's look, chosen in Settings: background, text and accent colors
 * (presets or any custom color) and a display font. Saved on this device
 * and applied as CSS variables on <html>, so every component just uses
 * var(--bg), var(--accent) and friends.
 *
 * Wallets can override the colors for themselves (see the Wallet screen);
 * whatever they leave unset falls back to these.
 */
import '@fontsource/barlow-condensed/900-italic';
import '@fontsource/barlow-condensed/600-italic';
import '@fontsource-variable/big-shoulders-display';
import '@fontsource/archivo-black';
import '@fontsource/anton';
import { getSetting, setSetting } from './db';
import { isHex, paletteVars, textOn, type Palette } from '#lib/ui/color.ts';

/** Quick picks shown as swatches. Any other color can be typed or picked. */
export const SWATCHES = {
	accent: ['#ffffff', '#ff1a1a', '#1e6bff', '#ffd60a', '#2bd96b', '#ff4fa3', '#ff7a00', '#8b5cf6'],
	bg: ['#000000', '#0b1020', '#1a0505', '#0d1a12', '#efede8', '#ffffff', '#ffd60a', '#1e6bff'],
	ink: ['#ffffff', '#000000', '#efede8', '#c8ff00', '#ff1a1a']
};

/**
 * `wide`: how wide the font's letters are compared to Barlow (1). Sizes
 * are divided by it (var(--font-wide)), so a wide font gets smaller text
 * and every layout takes the same room whichever font you pick.
 */
export const FONTS = {
	barlow: { name: 'Barlow', family: "'Barlow Condensed'", weight: 900, style: 'italic', bodyWeight: 600, wide: 1 },
	shoulders: { name: 'Big Shoulders', family: "'Big Shoulders Display Variable'", weight: 900, style: 'normal', bodyWeight: 600, wide: 1 },
	archivo: { name: 'Archivo', family: "'Archivo Black'", weight: 400, style: 'normal', bodyWeight: 400, wide: 1.45 },
	anton: { name: 'Anton', family: "'Anton'", weight: 400, style: 'normal', bodyWeight: 400, wide: 1.1 }
} as const;
export type FontId = keyof typeof FONTS;

/** Text color: a fixed color, or 'auto' (black or white, whichever reads best on the background). */
export type Ink = string | 'auto';

const DEFAULTS = { bg: '#000000', ink: 'auto' as Ink, accent: '#ffffff', font: 'barlow' as FontId };

/** Earlier versions saved accent names; map them to colors. */
const OLD_ACCENTS: Record<string, string> = {
	mono: '#ffffff', red: '#ff1a1a', blue: '#1e6bff', yellow: '#ffd60a', green: '#2bd96b', pink: '#ff4fa3'
};

let bg = $state(DEFAULTS.bg);
let ink = $state<Ink>(DEFAULTS.ink);
let accent = $state(DEFAULTS.accent);
let font = $state<FontId>(DEFAULTS.font);

export const resolveInk = (inkChoice: Ink | undefined, onBg: string) => (inkChoice && inkChoice !== 'auto' ? inkChoice : textOn(onBg));

/** The app-wide colors, with 'auto' text worked out. */
export function appPalette(): Palette {
	return { bg, ink: resolveInk(ink, bg), accent };
}

/** Set the browser/phone bar color to match a background. */
export function setBarColor(color: string) {
	document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
}

/** Color the whole page (and the phone's bar) with a palette. */
export function applyPalette(p: Palette) {
	const root = document.documentElement.style;
	for (const [k, v] of Object.entries(paletteVars(p))) root.setProperty(k, v);
	setBarColor(p.bg);
}

/**
 * A section can take over the page colors (Wallet does, for the selected
 * wallet). While it does, app color changes don't repaint over it.
 */
let override: Palette | null = null;
export function overridePalette(p: Palette | null) {
	override = p;
	applyPalette(p ?? appPalette());
}

function apply() {
	const root = document.documentElement.style;
	applyPalette(override ?? appPalette());
	const f = FONTS[font];
	root.setProperty('--font', `${f.family}, 'Arial Narrow', sans-serif`);
	root.setProperty('--font-weight', String(f.weight));
	root.setProperty('--font-style', f.style);
	root.setProperty('--font-body-weight', String(f.bodyWeight));
	root.setProperty('--font-wide', String(f.wide));
}

/** Call once at app start (the root layout does). Applies defaults right away, then the saved choice. */
export async function loadTheme(): Promise<void> {
	apply();
	const saved = await getSetting<{ bg?: string; ink?: Ink; accent?: string; font?: FontId }>('theme');
	if (saved) {
		if (isHex(saved.bg)) bg = saved.bg;
		if (saved.ink === 'auto' || isHex(saved.ink)) ink = saved.ink;
		if (isHex(saved.accent)) accent = saved.accent;
		else if (saved.accent && OLD_ACCENTS[saved.accent]) accent = OLD_ACCENTS[saved.accent];
		if (saved.font && saved.font in FONTS) font = saved.font;
	}
	apply();
}

export const theme = {
	get bg() {
		return bg;
	},
	get ink() {
		return ink;
	},
	get accent() {
		return accent;
	},
	get font() {
		return font;
	},
	async set(next: { bg?: string; ink?: Ink; accent?: string; font?: FontId }) {
		if (next.bg) bg = next.bg;
		if (next.ink) ink = next.ink;
		if (next.accent) accent = next.accent;
		if (next.font) font = next.font;
		apply();
		await setSetting('theme', { bg, ink, accent, font });
	},
	async reset() {
		await this.set({ ...DEFAULTS });
	}
};
