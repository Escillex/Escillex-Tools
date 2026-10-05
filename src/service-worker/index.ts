import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

// One cache per deploy. A new deploy gets a new name, and the old one is
// deleted once the new worker takes over.
const CACHE = `workspace-${version}`;

// Everything the app needs to run with no internet: the built JS/CSS,
// files from /static, and the prerendered page shell.
const APP_FILES = [...immutable, ...assets, ...prerendered].map((f) => f.path);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
});

// The launcher's Update button: a new version waits until the user asks for it.
self.addEventListener('message', (event) => {
	if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;
	// API calls (the sync relay, later) always go to the network.
	if (url.pathname.startsWith('/api/')) return;

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
