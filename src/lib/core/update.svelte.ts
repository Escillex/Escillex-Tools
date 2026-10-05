/**
 * "Update" button support.
 *
 * The service worker keeps the whole app cached, so a new deploy only
 * arrives when the browser fetches service-worker.js again. When it finds
 * a new one, that worker downloads the new files and then waits; it
 * doesn't take over by itself. check() asks for that fetch now, and
 * apply() tells the waiting worker to take over and reloads onto it.
 * Data lives in IndexedDB, which updating never touches.
 */

export type UpdateStatus = 'idle' | 'checking' | 'ready' | 'latest' | 'offline';

let status = $state<UpdateStatus>('idle');

const supported = () => 'serviceWorker' in navigator;

/** Resolves once a freshly found worker has finished downloading (or failed). */
function settled(worker: ServiceWorker): Promise<void> {
	return new Promise((resolve) => {
		if (worker.state !== 'installing') return resolve();
		worker.addEventListener('statechange', () => {
			if (worker.state !== 'installing') resolve();
		});
	});
}

/** Call once at app start (the root layout does). */
export async function listenForUpdates(): Promise<void> {
	if (!supported()) return;
	const reg = await navigator.serviceWorker.getRegistration();
	if (!reg) return;
	// A new version found earlier (or by the browser's own check) may already be waiting.
	if (reg.waiting && navigator.serviceWorker.controller) status = 'ready';
	reg.addEventListener('updatefound', async () => {
		const worker = reg.installing;
		if (!worker) return;
		await settled(worker);
		if (reg.waiting && navigator.serviceWorker.controller) status = 'ready';
	});
}

export const update = {
	get status() {
		return status;
	},
	/** Ask the server whether there's a newer version. The only request this makes is service-worker.js. */
	async check(): Promise<void> {
		if (!supported()) return location.reload();
		const reg = await navigator.serviceWorker.getRegistration();
		if (!reg) return location.reload();
		status = 'checking';
		try {
			await reg.update();
		} catch {
			status = 'offline';
			return;
		}
		if (reg.installing) await settled(reg.installing);
		status = reg.waiting ? 'ready' : 'latest';
	},
	/** Switch to the downloaded version and reload onto it. */
	async apply(): Promise<void> {
		const reg = await navigator.serviceWorker.getRegistration();
		if (!reg?.waiting) return location.reload();
		navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
		reg.waiting.postMessage({ type: 'SKIP_WAITING' });
	}
};
