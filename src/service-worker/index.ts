import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { LAZY_CACHE, isLazy, samePath, swCachesLazily } from '../lib/bgremove/lazy';

// One cache per deploy. A new deploy gets a new name, and the old one is
// deleted once the new worker takes over.
const CACHE = `workspace-${version}`;

// BG REMOVE's downloads (models, runtime) live in their own caches and survive deploys.
const KEEP = [CACHE, LAZY_CACHE, 'bg-runtime', 'transformers-cache'];

// Everything the app needs to run with no internet: the built JS/CSS,
// files from /static, and the prerendered page shell. BG REMOVE's runtime
// and worker code are left out: they download the first time someone uses it.
const ALL_FILES = [...immutable, ...assets, ...prerendered].map((f) => f.path);
const APP_FILES = ALL_FILES.filter((p) => !isLazy(p));

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
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
			// Lazy worker code survives deploys, but files this deploy no longer has are dropped.
			const lazy = await caches.open(LAZY_CACHE);
			for (const req of await lazy.keys()) {
				const path = new URL(req.url).pathname;
				if (!ALL_FILES.some((f) => samePath(f, path))) await lazy.delete(req);
			}
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	// API calls (the sync relay, later) always go to the network.
	if (url.pathname.startsWith('/api/')) return;

	// BG REMOVE's worker code: cached the first time it's used, kept until a deploy replaces it.
	if (swCachesLazily(url.pathname)) {
		event.respondWith(
			(async () => {
				const lazy = await caches.open(LAZY_CACHE);
				const hit = await lazy.match(url.pathname);
				if (hit) return hit;
				const res = await fetch(req);
				if (res.ok) await lazy.put(url.pathname, res.clone());
				return res;
			})()
		);
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
