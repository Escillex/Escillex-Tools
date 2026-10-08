/**
 * What the service worker saves for offline use, shared with the pages
 * that ask about it (the font pickers, the "Saving for offline" bar).
 *
 * Code is saved at install. Fonts are mostly not: each one is saved the
 * first time the browser actually draws with it, so a device only keeps
 * the fonts its owner picked. Barlow Condensed, the default and the
 * fallback for every other display font, is the one exception.
 *
 * Font files are named '<family>-<subset>-<weight>-<style>.<hash>.woff2'
 * (fontsource's naming). Only the basic Latin subset counts as "saved":
 * other alphabets and the old .woff copies download only if a page needs them.
 */
export const FONT_CACHE = 'fonts';

export const isFontFile = (path: string) => /\.woff2?$/.test(path);

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** A basic Latin .woff2 of this family ('barlow-latin-…', not 'barlow-latin-ext-…' or 'barlow-condensed-latin-…'). */
export function isLatinOf(path: string, family: string): boolean {
	const name = fileName(path);
	return name.startsWith(`${family}-latin-`) && !name.startsWith(`${family}-latin-ext-`) && name.endsWith('.woff2');
}

export const DEFAULT_FONT_FAMILY = 'barlow-condensed';

/** Home-screen icons: the phone downloads and keeps them itself when the app is installed. */
const isHomeIcon = (path: string) => /(^|\/)(icon-\d+|apple-touch-icon)\.png$/.test(path);

/**
 * The files to save at install, in the order to fetch them: code and pages
 * first, then the default font, then the rest of /static. A slow
 * connection gets a working app before it gets the looks.
 */
export function installList(paths: string[]): string[] {
	const rank = (p: string) => (isFontFile(p) ? 1 : /\.(png|ico|svg|webmanifest)$/.test(p) ? 2 : 0);
	return paths
		.filter((p) => !isHomeIcon(p) && (!isFontFile(p) || isLatinOf(p, DEFAULT_FONT_FAMILY)))
		.sort((a, b) => rank(a) - rank(b));
}
