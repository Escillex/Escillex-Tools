/**
 * Color math for theming. Colors are "#rrggbb" strings.
 *
 * Contrast uses the WCAG formula: relative luminance of each color, then
 * (lighter + 0.05) / (darker + 0.05). 4.5 is comfortable for normal text,
 * 3 is the floor for big bold text; below that, things get hard to read.
 */

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** "#abc" / "abc" / "#AABBCC" → "#aabbcc", or null if it isn't a color. */
export function normalizeHex(text: string): string | null {
	let t = text.trim().replace(/^#/, '').toLowerCase();
	if (/^[0-9a-f]{3}$/.test(t)) t = [...t].map((c) => c + c).join('');
	return /^[0-9a-f]{6}$/.test(t) ? '#' + t : null;
}

function luminance(hex: string): number {
	const channel = (i: number) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on this color. */
export const textOn = (bg: string) => (contrast(bg, '#000000') >= contrast(bg, '#ffffff') ? '#000000' : '#ffffff');

export const isDark = (hex: string) => luminance(hex) < 0.2;

export interface Palette {
	bg: string;
	ink: string;
	accent: string;
}

/** The CSS variables for a palette (the rest are mixed in brutal.css). */
export function paletteVars(p: Palette): Record<string, string> {
	return {
		'--bg': p.bg,
		'--ink': p.ink,
		'--accent': p.accent,
		'--accent-ink': textOn(p.accent),
		'color-scheme': isDark(p.bg) ? 'dark' : 'light'
	};
}
