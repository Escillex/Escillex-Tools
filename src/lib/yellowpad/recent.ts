/**
 * The recent files list: newest first, one entry per file, ten at most.
 * Whether two handles are the same file is an async browser call, so the
 * caller works that out and passes it in; this part stays pure.
 */
export const MAX_RECENT = 10;

export interface Recent<H = FileSystemFileHandle> {
	id: string;
	name: string;
	handle: H;
	openedAt: number;
	/** The first lines as plain text, saved when the file is opened or saved (reading it later would need a permission prompt). */
	preview?: string;
}

const PREVIEW_LINES = 4;
const PREVIEW_WIDTH = 120;

/** A file's first few lines as plain text, for the Recent carousel. */
export function previewOf(markdown: string): string {
	const lines: string[] = [];
	for (const raw of markdown.split('\n')) {
		const t = raw.trim();
		// Lines that are only syntax: blank, code fences, rules, table delimiter rows.
		if (!t || /^(```|~~~)/.test(t) || /^([-*_]\s*){3,}$/.test(t) || /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(t)) continue;
		const text = t
			.replace(/^(>\s*)+/, '')
			.replace(/^#{1,6}\s+/, '')
			.replace(/^([-*+]|\d+[.)])\s+/, '')
			.replace(/^\[[ xX]\]\s+/, '')
			.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/(\*\*|__|\*|_|~~|`)/g, '')
			.replace(/^\||\|$/g, '')
			.split(/\s*\|\s*/)
			.join(' · ')
			.trim();
		if (!text) continue;
		lines.push([...text].length > PREVIEW_WIDTH ? [...text].slice(0, PREVIEW_WIDTH).join('') + '…' : text);
		if (lines.length === PREVIEW_LINES) break;
	}
	return lines.join('\n');
}

export function touch<T extends { openedAt: number }>(list: T[], entry: T, sameFile: boolean[], cap = MAX_RECENT): { keep: T[]; drop: T[] } {
	const others = list.filter((_, i) => !sameFile[i]).sort((a, b) => b.openedAt - a.openedAt);
	const all = [entry, ...others];
	return {
		keep: all.slice(0, cap),
		drop: [...list.filter((_, i) => sameFile[i]), ...all.slice(cap)]
	};
}
