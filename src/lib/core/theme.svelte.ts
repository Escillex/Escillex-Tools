/**
 * The app's look, chosen in Settings: background, text and accent colors
 * (presets or any custom color), a display font and a reading font. Saved
 * on this device and applied as CSS variables on <html>, so every
 * component just uses var(--bg), var(--accent), var(--font-read) and friends.
 *
 * Three layers, most specific wins (see appearance.ts):
 *   global (here) → tool (enterTool, while a tool's screens are open)
 *   → item (overridePalette, e.g. the selected wallet's colors).
 */
import '@fontsource/barlow-condensed/900-italic';
import '@fontsource/barlow-condensed/600-italic';
import '@fontsource-variable/big-shoulders-display';
import '@fontsource/archivo-black';
import '@fontsource/anton';
import { coreDb, getSetting, setSetting } from './db';
import { isLookKey, type Looks } from './sync/looks';
import { cleanToolLook, resolveLook, type Look, type ToolLook } from './appearance';
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

/**
 * Fonts for paragraphs (Markdown, notes). Display fonts are built for big
 * uppercase words and tire the eye over a paragraph. Each one is loaded
 * only when picked, so the app doesn't download all seven.
 */
export const READ_FONTS = {
	space: { name: 'Space Grotesk', family: "'Space Grotesk Variable'", load: () => import('@fontsource-variable/space-grotesk') },
	archivo: { name: 'Archivo', family: "'Archivo Variable'", load: () => import('@fontsource-variable/archivo') },
	barlow: {
		name: 'Barlow',
		family: "'Barlow'",
		load: () => Promise.all([import('@fontsource/barlow/400.css'), import('@fontsource/barlow/700.css')])
	},
	plex: {
		name: 'IBM Plex Sans',
		family: "'IBM Plex Sans'",
		load: () => Promise.all([import('@fontsource/ibm-plex-sans/400.css'), import('@fontsource/ibm-plex-sans/700.css')])
	},
	atkinson: {
		name: 'Atkinson Hyperlegible',
		family: "'Atkinson Hyperlegible'",
		load: () =>
			Promise.all([import('@fontsource/atkinson-hyperlegible/400.css'), import('@fontsource/atkinson-hyperlegible/700.css')])
	},
	serif: { name: 'Source Serif 4', family: "'Source Serif 4 Variable'", load: () => import('@fontsource-variable/source-serif-4') },
	mono: { name: 'JetBrains Mono', family: "'JetBrains Mono Variable'", load: () => import('@fontsource-variable/jetbrains-mono') }
} as const;
export type ReadFontId = keyof typeof READ_FONTS;

/** Text color: a fixed color, or 'auto' (black or white, whichever reads best on the background). */
export type Ink = string | 'auto';

const DEFAULTS = { bg: '#000000', ink: 'auto' as Ink, accent: '#ffffff', font: 'barlow' as FontId, read: 'space' as ReadFontId };

/** Earlier versions saved accent names; map them to colors. */
const OLD_ACCENTS: Record<string, string> = {
	mono: '#ffffff', red: '#ff1a1a', blue: '#1e6bff', yellow: '#ffd60a', green: '#2bd96b', pink: '#ff4fa3'
};

let bg = $state(DEFAULTS.bg);
let ink = $state<Ink>(DEFAULTS.ink);
let accent = $state(DEFAULTS.accent);
let font = $state<FontId>(DEFAULTS.font);
let read = $state<ReadFontId>(DEFAULTS.read);

/** The tool layer: set while a tool's screens are open (enterTool). */
let toolId = $state<string | null>(null);
let toolLook = $state<ToolLook>({});

export const resolveInk = (inkChoice: Ink | undefined, onBg: string) => (inkChoice && inkChoice !== 'auto' ? inkChoice : textOn(onBg));

/** The global look, from Settings. */
export function globalLook(): Look {
	return { bg, ink, accent, font, read };
}

function currentLook(): Look {
	return resolveLook(globalLook(), toolId ? toolLook : null);
}

/** The colors in effect (global + the open tool's), with 'auto' text worked out. */
export function appPalette(): Palette {
	const l = currentLook();
	return { bg: l.bg, ink: resolveInk(l.ink, l.bg), accent: l.accent };
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
	const l = currentLook();
	applyPalette(override ?? appPalette());
	const f = FONTS[l.font as FontId] ?? FONTS[DEFAULTS.font];
	root.setProperty('--font', `${f.family}, 'Arial Narrow', sans-serif`);
	root.setProperty('--font-weight', String(f.weight));
	root.setProperty('--font-style', f.style);
	root.setProperty('--font-body-weight', String(f.bodyWeight));
	root.setProperty('--font-wide', String(f.wide));
	const r = READ_FONTS[l.read as ReadFontId] ?? READ_FONTS[DEFAULTS.read];
	r.load(); // the stack below falls back to system-ui until it arrives
	root.setProperty('--font-read', `${r.family}, system-ui, sans-serif`);
}

/** Call once at app start (the root layout does). Applies defaults right away, then the saved choice. */
export async function loadTheme(): Promise<void> {
	apply();
	const saved = await getSetting<{ bg?: string; ink?: Ink; accent?: string; font?: FontId; read?: ReadFontId }>('theme');
	if (saved) {
		if (isHex(saved.bg)) bg = saved.bg;
		if (saved.ink === 'auto' || isHex(saved.ink)) ink = saved.ink;
		if (isHex(saved.accent)) accent = saved.accent;
		else if (saved.accent && OLD_ACCENTS[saved.accent]) accent = OLD_ACCENTS[saved.accent];
		if (saved.font && saved.font in FONTS) font = saved.font;
		if (saved.read && saved.read in READ_FONTS) read = saved.read;
	}
	apply();
}

/*
 * Looks sync between devices (sync/looks.ts): each one is saved with the
 * time it changed, under "<key>@at", and the newest change wins.
 */
async function saveLook(key: string, value: unknown, at = Date.now()) {
	await setSetting(key, value);
	await setSetting(`${key}@at`, at);
}

/** For sync: every look saved on this device, with when it last changed (0 = before looks synced). */
export async function looksForSync(): Promise<Looks> {
	const all = await coreDb.settings.toArray();
	const at = new Map(all.map((s) => [s.key, s.value]));
	const out: Looks = {};
	for (const s of all) if (isLookKey(s.key)) out[s.key] = { value: s.value, at: Number(at.get(`${s.key}@at`) ?? 0) };
	return out;
}

/** After a sync: save looks from another device (keeping their times, so this device doesn't look newer) and show them. */
export async function applyLooks(looks: Looks): Promise<void> {
	for (const [key, s] of Object.entries(looks)) if (isLookKey(key)) await saveLook(key, s.value, s.at);
	await loadTheme();
	if (toolId) await enterTool(toolId);
}

/** A tool's layout calls this on mount: its own look (from its settings) applies on top of the global one. */
export async function enterTool(id: string): Promise<void> {
	toolId = id;
	toolLook = {};
	const saved = cleanToolLook(await getSetting(`theme:${id}`), Object.keys(FONTS), Object.keys(READ_FONTS));
	if (toolId !== id) return; // left (or switched tool) while loading
	toolLook = saved;
	apply();
}

/** ...and this on unmount, handing the page back to the global look. */
export function leaveTool(): void {
	toolId = null;
	toolLook = {};
	apply();
}

export const toolTheme = {
	get id() {
		return toolId;
	},
	get look(): ToolLook {
		return toolLook;
	},
	/** Change the open tool's look. null for a key = back to Global. */
	async set(patch: { [K in keyof Look]?: string | null }) {
		if (!toolId) return;
		const next: ToolLook = { ...toolLook };
		for (const [k, v] of Object.entries(patch) as [keyof Look, string | null | undefined][]) {
			if (v === null) delete next[k];
			else if (v !== undefined) next[k] = v;
		}
		toolLook = next;
		apply();
		await saveLook(`theme:${toolId}`, next);
	}
};

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
	get read() {
		return read;
	},
	async set(next: { bg?: string; ink?: Ink; accent?: string; font?: FontId; read?: ReadFontId }) {
		if (next.bg) bg = next.bg;
		if (next.ink) ink = next.ink;
		if (next.accent) accent = next.accent;
		if (next.font) font = next.font;
		if (next.read) read = next.read;
		apply();
		await saveLook('theme', { bg, ink, accent, font, read });
	},
	async reset() {
		await this.set({ ...DEFAULTS });
	}
};
