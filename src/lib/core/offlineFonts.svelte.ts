/**
 * Which fonts can be picked right now. Online, all of them. Offline, only
 * the ones this device has saved (the service worker keeps a font once
 * the browser has drawn with it; see offline.ts), since picking any other
 * would just show a fallback font.
 */
import { FONT_CACHE, isLatinOf } from './offline';

let online = $state(true);
let saved = $state<string[]>([]);
let watching = false;

async function refresh() {
	online = navigator.onLine;
	if (online || !('caches' in window)) return;
	const kept = await (await caches.open(FONT_CACHE)).keys();
	saved = kept.map((r) => new URL(r.url).pathname);
}

/** Start following the connection. Safe to call from every picker; it only sets up once. */
export function watchOfflineFonts(): void {
	if (watching) return;
	watching = true;
	refresh();
	addEventListener('online', refresh);
	addEventListener('offline', refresh);
}

export const offlineFonts = {
	/** `file`: the font's family name in its files (FONTS / READ_FONTS in theme.svelte.ts). */
	usable(file: string): boolean {
		return online || saved.some((path) => isLatinOf(path, file));
	}
};
