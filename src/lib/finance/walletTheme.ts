/**
 * A wallet's colors, with anything it doesn't set falling back to the app.
 * If a wallet picks a background but no text color, its text adapts to
 * that background (black or white), so it always stays readable.
 */
import type { Palette } from '#lib/ui/color.ts';
import { resolveInk } from '#lib/core/theme.svelte.ts';
import type { Wallet } from './db';

export function walletPalette(w: Wallet | null | undefined, app: Palette): Palette {
	const t = w?.theme;
	if (!t) return app;
	const bg = t.bg ?? app.bg;
	return {
		bg,
		ink: t.ink ? resolveInk(t.ink, bg) : t.bg ? resolveInk('auto', bg) : app.ink,
		accent: t.accent ?? app.accent
	};
}

/** The palette as an inline style string, for an element with the "themed" class. */
export function paletteStyle(vars: Record<string, string>): string {
	return Object.entries(vars)
		.map(([k, v]) => `${k}: ${v}`)
		.join('; ');
}
