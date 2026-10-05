// All data lives in the browser (IndexedDB), so there's nothing for the
// server to render. Turn off SSR and prerender the app shell as static
// files; that's also what the service worker caches for offline use.
export const ssr = false;
export const prerender = true;
