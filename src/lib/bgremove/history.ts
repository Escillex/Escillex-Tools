/**
 * The rules for BG REMOVE's history, kept free of the database so they
 * can be tested: names, expiry, what to prune, and full-disk detection.
 */
export const DAY = 86_400_000;
export const EXPIRE_MS = 7 * DAY;
export const MAX_KEEP = 100;

export interface Cutout {
	id: string;
	/** The download name, e.g. dog-bgremoved.png. */
	name: string;
	createdAt: number;
	bytes: number;
	blob: Blob;
	/** ≤256 px copy for the dial and grid (decoding 100 full PNGs would eat memory). */
	thumb: Blob;
}

export function outName(fileName: string): string {
	const base = fileName.replace(/\.[^./\\]*$/, '');
	return `${base || 'image'}-bgremoved.png`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'expires 14:30' during the last 24 hours, otherwise nothing. */
export function expiryLabel(c: { createdAt: number }, now: number): string | null {
	const at = c.createdAt + EXPIRE_MS;
	const left = at - now;
	if (left <= 0 || left > DAY) return null;
	const d = new Date(at);
	return `expires ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Ids to delete: everything expired, plus the oldest beyond `keep`. */
export function prunePlan(items: { id: string; createdAt: number }[], now: number, keep: number): string[] {
	const live = items.filter((i) => now - i.createdAt < EXPIRE_MS).sort((a, b) => b.createdAt - a.createdAt);
	const expired = items.filter((i) => now - i.createdAt >= EXPIRE_MS);
	return [...expired, ...live.slice(keep)].map((i) => i.id);
}

export const clampKeep = (n: number) => (Number.isFinite(n) ? Math.min(MAX_KEEP, Math.max(1, Math.round(n))) : MAX_KEEP);

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i;

/** Images only. Some browsers give HEIC an empty type, so the extension counts too. */
export const acceptFile = (f: { type: string; name: string }) => f.type.startsWith('image/') || (!f.type && IMAGE_EXT.test(f.name));

export function isQuota(e: unknown): boolean {
	const err = e as { name?: string; inner?: { name?: string } } | null;
	return err?.name === 'QuotaExceededError' || err?.inner?.name === 'QuotaExceededError';
}
