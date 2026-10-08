<script lang="ts">
	/**
	 * Point the back camera at a pairing QR. Video frames go to a QR reader
	 * until it finds our kind of code, then the camera stops.
	 *
	 * The reader is the browser's own (BarcodeDetector) where there is one:
	 * Chrome, Android. Elsewhere (iPhone, Firefox) frames are copied onto a
	 * canvas and sent to jsQR in a worker, which downloads the first time
	 * someone scans instead of with the app.
	 */
	import { onMount } from 'svelte';
	import { parseCode } from './crypto';

	let { onfound }: { onfound: (code: string) => void } = $props();

	let video: HTMLVideoElement;
	let message = $state('Starting camera…');

	type Reader = { read: (video: HTMLVideoElement) => Promise<string | null>; stop: () => void };

	type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
	type DetectorClass = { new (opts: { formats: string[] }): Detector; getSupportedFormats: () => Promise<string[]> };

	async function browserReader(): Promise<Reader | null> {
		const BarcodeDetector = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
		if (!BarcodeDetector || !(await BarcodeDetector.getSupportedFormats().catch((): string[] => [])).includes('qr_code')) return null;
		const detector = new BarcodeDetector({ formats: ['qr_code'] });
		return { read: async (v) => (await detector.detect(v))[0]?.rawValue ?? null, stop: () => {} };
	}

	function jsqrReader(onfail: () => void): Reader {
		const worker = new Worker(new URL('./qr.worker.ts', import.meta.url), { type: 'module' });
		worker.onerror = onfail; // offline, and never scanned here before
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
		let answer: ((text: string | null) => void) | null = null;
		worker.onmessage = (e: MessageEvent<string | null>) => answer?.(e.data);
		return {
			read(v) {
				// Scan a smaller copy: much faster, and still plenty of detail for a QR.
				const scale = Math.min(1, 640 / v.videoWidth);
				canvas.width = Math.round(v.videoWidth * scale);
				canvas.height = Math.round(v.videoHeight * scale);
				ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
				const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
				return new Promise((resolve) => {
					answer = resolve;
					worker.postMessage(img, [img.data.buffer]);
				});
			},
			stop: () => worker.terminate()
		};
	}

	onMount(() => {
		let stream: MediaStream | null = null;
		let reader: Reader | null = null;
		let frame = 0;
		let done = false;

		// One frame at a time: the next is read only after the reader answers.
		const scan = async () => {
			if (done || !reader) return;
			if (video.readyState >= 2 && video.videoWidth) {
				const text = await reader.read(video).catch(() => null);
				if (done) return;
				if (text) {
					const code = parseCode(text);
					if (code) {
						done = true;
						onfound(code);
						return;
					}
					message = "That QR isn't a pairing code.";
				}
			}
			frame = requestAnimationFrame(scan);
		};

		const noScanner = () => {
			done = true;
			stream?.getTracks().forEach((t) => t.stop());
			message = "Can't scan without internet the first time. Paste the code below instead.";
		};

		if (!navigator.mediaDevices) message = "This browser can't use the camera. Paste the code below instead.";
		else
			Promise.all([navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }), browserReader()])
				.then(([s, native]) => {
					stream = s;
					if (done) return s.getTracks().forEach((t) => t.stop()); // closed while starting
					reader = native ?? jsqrReader(noScanner);
					video.srcObject = s;
					video.play();
					message = 'Point at the QR on your other device';
					frame = requestAnimationFrame(scan);
				})
				.catch(() => {
					message = "Can't use the camera. Allow camera access, or paste the code below instead.";
				});

		return () => {
			done = true;
			cancelAnimationFrame(frame);
			reader?.stop();
			stream?.getTracks().forEach((t) => t.stop()); // turn the camera light off
		};
	});
</script>

<div class="scanner">
	<!-- svelte-ignore a11y_media_has_caption -->
	<video bind:this={video} playsinline muted></video>
	<span class="frame" aria-hidden="true"></span>
</div>
<p class="msg" role="status">{message}</p>

<style>
	.scanner {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		max-width: 320px;
		margin: 0 auto;
		border-radius: 20px;
		overflow: hidden;
		background: var(--faint);
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.frame {
		position: absolute;
		inset: 18%;
		border: 2px solid rgb(255 255 255 / 0.7);
		border-radius: 16px;
	}
	.msg {
		text-align: center;
		color: rgb(255 255 255 / 0.55);
		margin: 10px 0 0;
	}
</style>
