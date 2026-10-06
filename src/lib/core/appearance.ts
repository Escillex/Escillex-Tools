/**
 * The app's look in layers: global (Settings) → tool (each tool's own
 * settings) → item (a wallet's colors, handled by the tool). A layer only
 * overrides the keys it sets, so "Global" just means "leave it unset".
 *
 * Kept free of Svelte and fonts so it can be tested on its own.
 */
import { isHex } from '#lib/ui/color.ts';

export interface Look {
	bg: string;
	/** A hex color, or 'auto' (black or white, whichever reads best on bg). */
	ink: string;
	accent: string;
	/** Display font id (FONTS in theme.svelte.ts). */
	font: string;
	/** Reading font id (READ_FONTS in theme.svelte.ts). */
	read: string;
}

export type ToolLook = Partial<Look>;

export function resolveLook(global: Look, tool: ToolLook | null | undefined): Look {
	if (!tool) return global;
	return {
		bg: tool.bg ?? global.bg,
		// A tool that changes the background but not the text gets text that
		// adapts to its background, the same rule wallets use.
		ink: tool.ink ?? (tool.bg ? 'auto' : global.ink),
		accent: tool.accent ?? global.accent,
		font: tool.font ?? global.font,
		read: tool.read ?? global.read
	};
}

/** Whatever was saved, keep only keys that are still valid. */
export function cleanToolLook(saved: unknown, fonts: readonly string[], reads: readonly string[]): ToolLook {
	if (!saved || typeof saved !== 'object') return {};
	const s = saved as Record<string, unknown>;
	const out: ToolLook = {};
	if (isHex(s.bg)) out.bg = s.bg;
	if (s.ink === 'auto' || isHex(s.ink)) out.ink = s.ink;
	if (isHex(s.accent)) out.accent = s.accent;
	if (typeof s.font === 'string' && fonts.includes(s.font)) out.font = s.font;
	if (typeof s.read === 'string' && reads.includes(s.read)) out.read = s.read;
	return out;
}
