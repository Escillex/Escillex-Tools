/**
 * One "Sync all" run, as a small state machine the UI can watch:
 *
 *   idle → connecting → searching → sending → receiving → comparing → review → applying → done
 *                                                                   ↘ error (any step)
 *
 * Both devices press Sync all and connect to the room for their pairing
 * code. Nothing is sent until the room says the other device is there; then
 * each seals its snapshot and the room passes it across. Nothing changes on
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

/** Both devices press Sync at about the same moment, so don't wait long. */
const SEARCH_MS = 2 * 60 * 1000;

/** Close codes from the room (see src/lib/server/room.ts). */
const CLOSE_MESSAGES: Record<number, string> = {
	4000: "The sync server didn't accept this device's data. Update the app on both devices and try again.",
	4001: 'This device started syncing again in another tab or window.',
	4009: 'Two of your devices are syncing right now. Try again in a moment.',
	4029: 'Too many sync attempts. Wait a minute and try again.'
};
const LOST = 'Lost connection to the sync server. Check your internet and try again.';
const TIMED_OUT = "Didn't find your other device. Press Sync all on both at the same time.";
const PEER_LEFT = 'Your other device disconnected. Press Sync all on both again.';
const NOT_YOURS = "Got data from a device that isn't using your pairing code. Pair again and try once more.";

export type SyncStatus =
	| { step: 'idle' }
	| { step: 'connecting' }
	| { step: 'searching'; since: number }
	| { step: 'sending' }
	| { step: 'receiving' }
	| { step: 'comparing' }
	| { step: 'review'; comparison: Comparison }
	| { step: 'applying' }
	| { step: 'done'; written: number }
	| { step: 'error'; message: string };

let status = $state<SyncStatus>({ step: 'idle' });
let code = $state<string | null>(null);
let pending: Snapshot | null = null;
/** Ends the current run's connection; null when nothing is running. */
let stopRun: (() => void) | null = null;

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

function roomUrl(mailboxId: string, device: string): URL {
	const url = new URL(`/api/sync/room/${mailboxId}`, location.href);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.searchParams.set('device', device);
	return url;
}

export async function startSync(): Promise<void> {
	if (!code) return;
	cancel();
	if (!secureEnough()) {
		status = { step: 'error', message: INSECURE_MESSAGE };
		return;
	}

	status = { step: 'connecting' };
	let ws: WebSocket;
	let key: CryptoKey;
	try {
		const keys = await deriveKeys(code);
		key = keys.key;
		ws = new WebSocket(roomUrl(keys.mailboxId, await deviceId()));
	} catch {
		status = { step: 'error', message: LOST };
		return;
	}

	let ended = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let sealed: string | null = null;
	let sent = false;
	let received: Envelope | null = null;
	let comparing = false;

	const end = () => {
		ended = true;
		clearTimeout(timer);
		if (stopRun === end) stopRun = null;
		try {
			ws.close();
		} catch {
			// already closed
		}
	};
	const fail = (message: string) => {
		if (ended) return;
		end();
		status = { step: 'error', message };
	};
	stopRun = end;
	timer = setTimeout(() => fail(TIMED_OUT), SEARCH_MS);

	/** Once we've sent ours and have theirs: unlock, compare, and show the review. */
	const finish = async () => {
		if (!sent || !received || comparing || ended) return;
		comparing = true;
		status = { step: 'receiving' };
		let theirs: Snapshot;
		try {
			theirs = await open<Snapshot>(received, key);
			if (theirs?.format !== 1 || typeof theirs.tools !== 'object') throw new Error('not a snapshot');
		} catch {
			fail(NOT_YOURS);
			return;
		}
		ws.send(JSON.stringify({ t: 'done' }));
		end();
		status = { step: 'comparing' };
		pending = theirs;
		status = { step: 'review', comparison: compare(await buildSnapshot(), [theirs]) };
	};

	ws.onopen = () => {
		if (!ended) status = { step: 'searching', since: Date.now() };
	};

	ws.onmessage = async (e: MessageEvent) => {
		if (ended || typeof e.data !== 'string') return;
		let msg: { t?: string; envelope?: Envelope };
		try {
			msg = JSON.parse(e.data);
		} catch {
			return;
		}
		if (msg.t === 'peer-joined') {
			// Can come twice if the other device reconnects: it lost what we sent, so send again.
			clearTimeout(timer);
			if (!received) status = { step: 'sending' };
			try {
				sealed ??= JSON.stringify({ t: 'snapshot', envelope: await seal(await buildSnapshot(), key) });
			} catch {
				fail("Couldn't read this device's data to send it. Try again.");
				return;
			}
			if (ended) return;
			ws.send(sealed);
			sent = true;
			await finish();
		} else if (msg.t === 'snapshot' && msg.envelope) {
			received = msg.envelope;
			await finish();
		} else if (msg.t === 'peer-left') {
			if (!received) fail(PEER_LEFT);
		}
	};

	ws.onclose = (e: CloseEvent) => fail(CLOSE_MESSAGES[e.code] ?? LOST);
}

/** You confirmed the comparison: merge the other device's newer records in. */
export async function confirmSync(): Promise<void> {
	if (status.step !== 'review' || !pending) return;
	try {
		status = { step: 'applying' };
		const written = await applyRemotes([pending]);
		pending = null;
		status = { step: 'done', written };
	} catch {
		status = { step: 'error', message: "Couldn't save the merged data on this device. Nothing was lost; try again." };
	}
}

export function cancel(): void {
	stopRun?.();
	stopRun = null;
	pending = null;
	status = { step: 'idle' };
}
