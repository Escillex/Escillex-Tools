/**
 * One "Sync all" run, as a small state machine the UI can watch:
 *
 *   idle → sending → waiting (polls for the other device) → review → applying → done
 *                                                          ↘ error (any step)
 *
 * Both devices press Sync all. Each drops its sealed snapshot in the
 * mailbox, then waits until it finds the other's. Nothing changes on
 * this device until you confirm the comparison.
 */
import { getSetting, setSetting, coreDb } from '#lib/core/db.ts';
import { deriveKeys, open, seal, type Envelope } from './crypto';
import { applyRemotes, buildSnapshot, compare, type Comparison, type Snapshot } from './snapshot';

/**
 * Browsers only allow encryption on secure pages (https, or localhost).
 * Opening the dev server by its network address (http://192.168…) isn't.
 */
export const secureEnough = () => typeof crypto !== 'undefined' && !!crypto.subtle;
export const INSECURE_MESSAGE =
	"Sync and backups need a secure connection, and this page isn't one (it's plain http). Open the app at https://tools.escillex.com, or on this computer at localhost.";

const POLL_MS = 3000;
const GIVE_UP_MS = 10 * 60 * 1000; // matches how long the server keeps snapshots
const REUPLOAD_MS = 60 * 1000; // refresh our snapshot every minute while waiting
const FRESH_WINDOW_MS = 2 * 60 * 1000; // others' snapshots must be at most this much older than ours

export type SyncStatus =
	| { step: 'idle' }
	| { step: 'sending' }
	| { step: 'waiting'; since: number }
	| { step: 'review'; comparison: Comparison; devices: number; skipped: number }
	| { step: 'applying' }
	| { step: 'done'; written: number }
	| { step: 'error'; message: string };

let status = $state<SyncStatus>({ step: 'idle' });
let code = $state<string | null>(null);
let pending: Snapshot[] = [];
let stopPolling: (() => void) | null = null;

export const sync = {
	get status() {
		return status;
	},
	/** The saved pairing code, or null if this device isn't paired yet. */
	get code() {
		return code;
	},
	get paired() {
		return code !== null;
	}
};

/** Load the saved code (call once when the sync UI mounts). */
export async function loadCode(): Promise<void> {
	code = (await getSetting<string>('syncCode')) ?? null;
}

export async function saveCode(next: string): Promise<void> {
	await setSetting('syncCode', next);
	code = next;
}

export async function forgetCode(): Promise<void> {
	cancel();
	await coreDb.settings.delete('syncCode');
	code = null;
}

async function deviceId(): Promise<string> {
	return (await getSetting<string>('deviceId')) ?? '';
}

async function api(path: string, init?: RequestInit): Promise<Response> {
	const res = await fetch(`/api/sync/${path}`, init);
	if (res.status === 429) throw new Error('Too many sync attempts. Wait a minute and try again.');
	if (!res.ok) throw new Error(`The sync server said no (${res.status}). Try again in a moment.`);
	return res;
}

export async function startSync(): Promise<void> {
	if (!code) return;
	cancel();
	if (!secureEnough()) {
		status = { step: 'error', message: INSECURE_MESSAGE };
		return;
	}
	try {
		status = { step: 'sending' };
		const { mailboxId, key } = await deriveKeys(code);
		const me = await deviceId();

		/** Seal a fresh snapshot and drop it in the mailbox. Returns the server's timestamp. */
		const upload = async (): Promise<number> => {
			const envelope = await seal(await buildSnapshot(), key);
			const res = await api(`${mailboxId}/${me}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(envelope)
			});
			return ((await res.json()) as { at: number }).at;
		};

		// Only snapshots uploaded around the same time as ours count. Older ones
		// are leftovers from a previous sync and would bring back stale data.
		const firstUpload = await upload();
		const freshAfter = firstUpload - FRESH_WINDOW_MS;

		status = { step: 'waiting', since: Date.now() };
		await new Promise<void>((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout>;
			let stopped = false;
			stopPolling = () => {
				stopped = true;
				clearTimeout(timer);
				resolve();
			};
			const started = Date.now();
			let lastUpload = Date.now();
			const poll = async () => {
				if (stopped) return;
				try {
					// Keep our own snapshot fresh while we wait, so a device that
					// presses Sync all a few minutes later still counts it.
					if (Date.now() - lastUpload > REUPLOAD_MS) {
						await upload();
						lastUpload = Date.now();
					}
					const res = await api(`${mailboxId}?device=${me}`);
					const all = (await res.json()) as { device: string; at: number; envelope: Envelope }[];
					const found = all.filter((f) => f.at >= freshAfter);
					if (found.length > 0) {
						stopPolling = null;
						await review(found, key);
						resolve();
						return;
					}
				} catch (e) {
					reject(e);
					return;
				}
				if (Date.now() - started > GIVE_UP_MS) {
					reject(new Error("The other device didn't show up within 10 minutes. Press Sync all on both devices."));
					return;
				}
				timer = setTimeout(poll, POLL_MS);
			};
			poll();
		});
	} catch (e) {
		status = { step: 'error', message: e instanceof Error ? e.message : 'Sync failed. Try again.' };
	}
}

async function review(found: { device: string; envelope: Envelope }[], key: CryptoKey): Promise<void> {
	const opened: Snapshot[] = [];
	let skipped = 0;
	for (const f of found) {
		try {
			const snap = await open<Snapshot>(f.envelope, key);
			if (snap?.format === 1 && typeof snap.tools === 'object') opened.push(snap);
			else skipped++;
		} catch {
			skipped++; // wrong key or tampered: not from one of your devices
		}
	}
	if (opened.length === 0) {
		throw new Error("Found data in the mailbox, but it didn't come from one of your devices. Re-pair and try again.");
	}
	pending = opened;
	status = { step: 'review', comparison: compare(await buildSnapshot(), opened), devices: opened.length, skipped };
}

/** You confirmed the comparison: merge the other device's newer records in. */
export async function confirmSync(): Promise<void> {
	if (status.step !== 'review') return;
	try {
		status = { step: 'applying' };
		const written = await applyRemotes(pending);
		pending = [];
		status = { step: 'done', written };
	} catch {
		status = { step: 'error', message: "Couldn't save the merged data on this device. Nothing was lost; try again." };
	}
}

export function cancel(): void {
	stopPolling?.();
	stopPolling = null;
	pending = [];
	status = { step: 'idle' };
}
