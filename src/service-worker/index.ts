import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { LAZY_CACHE, isLazy, samePath, swCachesLazily } from '../lib/bgremove/lazy';
import { FONT_CACHE, installList, isFontFile } from '../lib/core/offline';

// One cache per deploy. A new deploy gets a new name, and the old one is
// deleted once the new worker takes over.
const CACHE = `workspace-${version}`;

// Downloads that survive deploys: BG REMOVE's (models, runtime, worker code) and the fonts.
const KEEP = [CACHE, LAZY_CACHE, FONT_CACHE, 'bg-runtime', 'transformers-cache'];

// Everything the app needs to run with no internet: the built JS/CSS,
// files from /static, and the prerendered page shell. Left out: BG REMOVE's
// runtime and worker code (they download the first time someone uses it)
// and every font but the default (saved the first time it's drawn; see offline.ts).
const ALL_FILES = [...immutable, ...assets, ...prerendered].map((f) => f.path);
const APP_FILES = installList(ALL_FILES.filter((p) => !isLazy(p)));

/** Tell every open page how far the download is (the launcher shows a bar). */
async function report(progress: { done: number; total: number } | { failed: true }) {
	const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
	for (const page of pages) page.postMessage({ type: 'saving', ...progress });
}

const exists = (cache: Cache, path: string) => cache.match(path).then(Boolean);

async function save(path: string, cache: Cache, fonts: Cache) {
	const target = isFontFile(path) ? fonts : cache;
	if (await exists(target, path)) return; // fonts are kept across deploys
	// Built files have their content's hash in the name, so a file the previous
	// version already saved is byte-for-byte the same: copy it, don't download it.
	if (path.includes('_app/immutable/')) {
		const old = await caches.match(path);
		if (old) return target.put(path, old);
	}
	// Pages and /static files keep their names across deploys: ask the server, not the HTTP cache.
	const res = await fetch(path, { cache: path.includes('_app/immutable/') ? 'default' : 'no-cache' });
	if (!res.ok) throw new Error(`${path}: ${res.status}`);
	await target.put(path, res);
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const [cache, fonts] = await Promise.all([caches.open(CACHE), caches.open(FONT_CACHE)]);
			const total = APP_FILES.length;
			let next = 0;
			let done = 0;
			await report({ done, total });
			// A few downloads at a time, taken in APP_FILES order (code first, looks last).
			const lane = async () => {
				while (next < total) {
					await save(APP_FILES[next++], cache, fonts);
					await report({ done: ++done, total });
				}
			};
			try {
				await Promise.all(Array.from({ length: 6 }, lane));
			} catch (err) {
				await report({ failed: true });
				throw err; // the install fails; the browser tries again later
			}
		})()
	);
});

// The launcher's Update button: a new version waits until the user asks for it.
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
			// Lazy code and fonts survive deploys, but files this deploy no longer has are dropped.
			for (const name of [LAZY_CACHE, FONT_CACHE]) {
				const kept = await caches.open(name);
				for (const req of await kept.keys()) {
					const path = new URL(req.url).pathname;
					if (!ALL_FILES.some((f) => samePath(f, path))) await kept.delete(req);
				}
			}
		})()
	);
});

/** Serve from a kept cache, or download and keep it (used for lazy code and fonts). */
async function keepOnFirstUse(cacheName: string, req: Request, path: string): Promise<Response> {
	const kept = await caches.open(cacheName);
	const hit = await kept.match(path);
	if (hit) return hit;
	const res = await fetch(req);
	if (res.ok) await kept.put(path, res.clone());
	return res;
}

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	// API calls (the sync relay, later) always go to the network.
	if (url.pathname.startsWith('/api/')) return;

	// BG REMOVE's and the QR fallback's worker code: cached the first time it's used, kept until a deploy replaces it.
	if (swCachesLazily(url.pathname)) {
		event.respondWith(keepOnFirstUse(LAZY_CACHE, req, url.pathname));
		return;
	}

	// Fonts: saved the first time the browser draws with one. Offline and never
	// drawn, the request fails and the text falls back to the next font in the stack.
	if (isFontFile(url.pathname)) {
		event.respondWith(keepOnFirstUse(FONT_CACHE, req, url.pathname).catch(() => Response.error()));
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Built files and static assets never change within a version: cache first.
			const cached = await cache.match(url.pathname);
			if (cached && APP_FILES.includes(url.pathname)) return cached;

			try {
				return await fetch(req);
			} catch {
				// Offline. For page loads, fall back to the cached app shell;
				// the app itself reads everything from IndexedDB.
				if (req.mode === 'navigate') {
					const shell = await cache.match('/');
					if (shell) return shell;
				}
				return cached ?? Response.error();
			}
		})()
	);
});
