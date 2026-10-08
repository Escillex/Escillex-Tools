/// <reference lib="webworker" />
/**
 * QR reading for browsers without a QR reader of their own (iPhone,
 * Firefox). Being a worker keeps jsQR out of the app's install download:
 * worker code is fetched only the first time someone scans (see lazy.ts).
 * It also keeps the pixel crunching off the main thread.
 */
import jsQR from 'jsqr';

self.onmessage = (e: MessageEvent<ImageData>) => {
	const img = e.data;
	const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
	postMessage(hit?.data ?? null);
};
