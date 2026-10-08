/**
 * Files needed only once someone actually uses them: BG REMOVE's runtime,
 * and every Web Worker's code (BG REMOVE's, and the QR scanner's fallback
 * for browsers with no QR reader of their own). The service worker skips
 * them when installing (so every device doesn't download megabytes it may
 * never use) and caches them on first use instead.
 *
 * SvelteKit's manifest lists paths without a leading slash ('_app/...'),
 * requests have one ('/_app/...'), so everything here accepts both.
 */
export const LAZY_CACHE = 'lazy-code';

const bare = (path: string) => path.replace(/^\//, '');

const WORKERS = '_app/immutable/workers/';

export const isLazy = (path: string) => bare(path).startsWith('ort/') || bare(path).startsWith(WORKERS);

/** The runtime files are cached by the BG worker itself (it needs them unzipped anyway); worker code by the service worker. */
export const swCachesLazily = (path: string) => bare(path).startsWith(WORKERS);

export const samePath = (a: string, b: string) => bare(a) === bare(b);
