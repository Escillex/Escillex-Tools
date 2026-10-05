/**
 * "Install app" support.
 *
 * Chrome, Edge and Android fire a `beforeinstallprompt` event when the
 * site qualifies as an installable PWA. We catch it, stop the browser's
 * own mini-banner, and keep it so our button can show the real prompt
 * later. Safari on iPhone never fires it; there you install through
 * Share → Add to Home Screen, so we show those steps instead.
 *
 * Safari (every browser on iPhone/iPad, and Safari on a Mac) deletes a
 * website's data after 7 days without a visit, and keeps it separate from
 * the installed app's. So there the app only runs installed; in the
 * browser it shows install steps instead (see InstallGate).
 */

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred = $state<InstallPromptEvent | null>(null);
let installed = $state(false);

const isIOS = () =>
	/iphone|ipad|ipod/i.test(navigator.userAgent) ||
	// iPadOS reports itself as a Mac; touch support gives it away.
	(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Safari on a Mac (not Chrome, Edge, Firefox or Opera, which also say "Safari"). */
const isMacSafari = () =>
	navigator.platform === 'MacIntel' &&
	navigator.maxTouchPoints <= 1 &&
	/safari/i.test(navigator.userAgent) &&
	!/chrome|chromium|crios|edg|firefox|fxios|opr/i.test(navigator.userAgent);

/** Safari's major version (from "Version/17.4"), or 0 if it doesn't say. */
const safariVersion = () => Number(/version\/(\d+)/i.exec(navigator.userAgent)?.[1] ?? 0);

/** Call once at app start (the root layout does). */
export function listenForInstall(): void {
	installed =
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;

	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferred = e as InstallPromptEvent;
	});
	window.addEventListener('appinstalled', () => {
		installed = true;
		deferred = null;
	});
}

export const install = {
	/** Already running as an installed app (or just got installed). */
	get installed() {
		return installed;
	},
	/** The browser handed us a real install prompt we can show. */
	get canPrompt() {
		return deferred !== null;
	},
	/** iPhone/iPad Safari: no prompt exists, show manual steps. */
	get needsManualSteps() {
		return !installed && deferred === null && isIOS();
	},
	/** Safari-family browser outside the installed app: the app won't run here. */
	get mustInstall() {
		return !installed && (isIOS() || isMacSafari());
	},
	/** Which install steps to show. */
	get platform(): 'ios' | 'mac' | 'other' {
		return isIOS() ? 'ios' : isMacSafari() ? 'mac' : 'other';
	},
	/** Mac Safari before 17 has no "Add to Dock", so it can't install at all. */
	get macCanInstall() {
		return safariVersion() >= 17;
	},
	/** Show the browser's install dialog. Returns true if the user accepted. */
	async prompt(): Promise<boolean> {
		if (!deferred) return false;
		const event = deferred;
		deferred = null; // each prompt event can only be used once
		await event.prompt();
		return (await event.userChoice).outcome === 'accepted';
	}
};
