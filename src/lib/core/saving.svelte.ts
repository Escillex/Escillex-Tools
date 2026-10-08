/**
 * "Saving for offline" progress. While the service worker downloads the
 * app (first visit) or a new version (an update), it reports each file
 * it finishes; the launcher shows that as a bar along its top edge.
 */

export type Saving = { done: number; total: number; update: boolean };

let progress = $state<Saving | null>(null);

/** Call once at app start (the root layout does). */
export function listenForSaving(): void {
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	navigator.serviceWorker.addEventListener('message', (e) => {
		const d = e.data;
		if (d?.type !== 'saving') return;
		if (d.failed || d.done >= d.total) progress = null;
		// A page already running on a service worker is getting an update, not its first copy.
		else progress = { done: d.done, total: d.total, update: !!navigator.serviceWorker.controller };
	});
	// Deliver messages sent before this page finished loading.
	navigator.serviceWorker.startMessages();
}

export const saving = {
	get progress() {
		return progress;
	}
};
