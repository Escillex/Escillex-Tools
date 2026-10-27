/**
 * How FOCUS gets your attention: a chime (one for focus ending, another
 * for a break ending), a buzz, and a system notification fired by the
 * page itself. No server push: it works while the page is alive (a
 * background tab on desktop; best effort on a locked phone).
 * Plus the optional screen wake lock.
 */
import { audio, buzz } from '#lib/ui/feedback.ts';
import type { Phase } from './engine';

/** [frequency Hz, start offset s] per note. Focus done rises (break time); a break ending falls (back to work). */
const NOTES: Record<'focus' | 'break', [number, number][]> = {
	focus: [
		[660, 0],
		[880, 0.18]
	],
	break: [
		[740, 0],
		[494, 0.22]
	]
};
const NOTE_S = 0.5;

/** The chime for the phase that ended (Sound switch permitting) and a strong buzz (Haptics permitting). */
export function chime(ended: Phase): void {
	buzz(true);
	const ctx = audio();
	if (!ctx) return;
	for (const [freq, offset] of NOTES[ended === 'focus' ? 'focus' : 'break']) {
		const start = ctx.currentTime + offset;
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + NOTE_S);
		gain.connect(ctx.destination);
		const osc = ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.value = freq;
		osc.connect(gain);
		osc.start(start);
		osc.stop(start + NOTE_S);
	}
}

export type NotifyState = 'on' | 'off' | 'ask' | 'blocked' | 'unsupported';

/** What the Notifications switch shows: your choice, unless the browser has the final say. */
export function notifyState(wanted: boolean, permission: NotificationPermission | undefined): NotifyState {
	if (permission === undefined) return 'unsupported';
	if (permission === 'denied') return 'blocked';
	if (!wanted) return 'off';
	return permission === 'granted' ? 'on' : 'ask';
}

export const permission = (): NotificationPermission | undefined => (typeof Notification === 'undefined' ? undefined : Notification.permission);

/** Asks only when the browser hasn't been asked yet. */
export async function askNotify(): Promise<NotificationPermission | undefined> {
	const p = permission();
	if (p !== 'default') return p;
	try {
		return await Notification.requestPermission();
	} catch {
		return permission();
	}
}

/**
 * One tag, so FOCUS keeps a single notification instead of a pile. renotify:
 * replacing one still sounds and pops up (else "Break over" lands silently
 * behind a "Focus done" you never dismissed).
 */
export function notifyOptions(body: string): NotificationOptions & { renotify: boolean } {
	return { body, tag: 'focus', icon: '/icon-192.png', renotify: true };
}

/**
 * Through the service worker when there is one (Android Chrome only allows
 * that), else a plain Notification. Never throws: a missing notification
 * mustn't break the timer.
 */
export async function notify(title: string, body: string): Promise<void> {
	try {
		if (permission() !== 'granted') return;
		const options = notifyOptions(body);
		const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
		if (reg) await reg.showNotification(title, options);
		else new Notification(title, options);
	} catch {
		// Unsupported here, or the browser refused: the chime still played.
	}
}

/** waiting: auto-start is off, so the next phase hasn't started yet. */
export function phaseText(ended: Phase, next: Phase | null, waiting = false): { title: string; body: string } {
	const title = next === null ? 'Cycle done' : { focus: 'Focus done', break: 'Break over', long: 'Long break over' }[ended];
	let body: string;
	if (next === null) body = 'Nice work. Press start for another round.';
	else if (waiting) body = next === 'focus' ? 'Press start to focus.' : next === 'long' ? 'Press start for your long break.' : 'Press start for your break.';
	else body = next === 'focus' ? 'Back to focus.' : next === 'long' ? 'Long break started.' : 'Break started.';
	return { title, body };
}

let lock: Awaited<ReturnType<WakeLock['request']>> | null = null;
let wanted = false;

// The browser drops the lock whenever the page is hidden; take it again on return.
function relock() {
	if (wanted && document.visibilityState === 'visible') holdScreen(true);
}

/** Keep the screen on (or let it sleep). Does nothing where the Wake Lock API is missing. */
export async function holdScreen(on: boolean): Promise<void> {
	wanted = on;
	if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
	if (on) {
		document.addEventListener('visibilitychange', relock);
		if (lock && !lock.released) return;
		try {
			const got = await navigator.wakeLock.request('screen');
			// Switched off while the request was pending: let go straight away.
			if (wanted) lock = got;
			else await got.release();
		} catch {
			lock = null; // low battery, or not allowed right now
		}
	} else {
		document.removeEventListener('visibilitychange', relock);
		await lock?.release().catch(() => {});
		lock = null;
	}
}
