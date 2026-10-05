/**
 * "Install app" support.
 *
 * Chrome, Edge and Android fire a `beforeinstallprompt` event when the
 * site qualifies as an installable PWA. We catch it, stop the browser's
 * own mini-banner, and keep it so our button can show the real prompt
 * later. Safari on iPhone never fires it; there you install through
 * Share → Add to Home Screen, so we show those steps instead.
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
	/** Show the browser's install dialog. Returns true if the user accepted. */
	async prompt(): Promise<boolean> {
		if (!deferred) return false;
		const event = deferred;
		deferred = null; // each prompt event can only be used once
		await event.prompt();
		return (await event.userChoice).outcome === 'accepted';
	}
};
