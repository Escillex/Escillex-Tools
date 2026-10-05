<script lang="ts">
	/**
	 * Point the back camera at a pairing QR. Each video frame is copied
	 * onto a hidden canvas and handed to jsQR, which looks for a QR code
	 * in the pixels. When it finds our kind of code, we stop the camera.
	 */
	import { onMount } from 'svelte';
	import jsQR from 'jsqr';
	import { parseCode } from './crypto';

	let { onfound }: { onfound: (code: string) => void } = $props();

	let video: HTMLVideoElement;
	let message = $state('Starting camera…');

	onMount(() => {
		let stream: MediaStream | null = null;
		let frame = 0;
		let done = false;
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

		const scan = () => {
			if (done) return;
			if (video.readyState >= 2 && video.videoWidth) {
				// Scan a smaller copy: much faster, and still plenty of detail for a QR.
				const scale = Math.min(1, 640 / video.videoWidth);
				canvas.width = Math.round(video.videoWidth * scale);
				canvas.height = Math.round(video.videoHeight * scale);
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
				const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
				if (hit) {
					const code = parseCode(hit.data);
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

		navigator.mediaDevices
			?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
			.then((s) => {
				stream = s;
				video.srcObject = s;
				video.play();
				message = 'Point at the QR on your other device';
				frame = requestAnimationFrame(scan);
			})
			.catch(() => {
				message = "Can't use the camera. Allow camera access, or paste the code below instead.";
			}) ?? (message = "This browser can't use the camera. Paste the code below instead.");

		return () => {
			done = true;
			cancelAnimationFrame(frame);
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
