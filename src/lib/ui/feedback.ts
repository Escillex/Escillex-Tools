/**
 * Click sound + haptic tap, shared by every tool.
 *
 * Browsers only allow sound after the user has touched the page, so call
 * unlockFeedback() from a pointerdown/keydown handler before the first tick().
 * Sound and haptics each follow their switch in Settings.
 */

let ctx: AudioContext | null = null;
let click: AudioBuffer | null = null;
let iosSwitch: HTMLLabelElement | null = null;
let lastTick = 0;

// Settings → Sound / Haptics. Set at start-up (lib/core/feedbackPrefs) and whenever they change.
let soundOn = true;
let hapticsOn = true;

export function setFeedbackGates(g: { sound: boolean; haptics: boolean }): void {
	soundOn = g.sound;
	hapticsOn = g.haptics;
}

/** The running audio context, or null when sound is off or not unlocked yet. Fidget's toy sounds play through it. */
export function audio(): AudioContext | null {
	return soundOn && ctx && ctx.state === 'running' ? ctx : null;
}

/** A 12ms burst of noise that fades out fast: sounds like a mechanical click. */
function makeClick(audio: AudioContext): AudioBuffer {
	const length = Math.floor(audio.sampleRate * 0.012);
	const buffer = audio.createBuffer(1, length, audio.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) {
		const fade = Math.pow(1 - i / length, 4);
		data[i] = (Math.random() * 2 - 1) * fade;
	}
	return buffer;
}

export function unlockFeedback(): void {
	if (!ctx) {
		ctx = new AudioContext();
		click = makeClick(ctx);
	}
	if (ctx.state === 'suspended') ctx.resume();
}

function playClick(strong: boolean): void {
	if (!ctx || !click || ctx.state !== 'running') return;
	const source = ctx.createBufferSource();
	source.buffer = click;
	// Narrow the noise to a crisp high band so it reads as a "tick", not static.
	const filter = ctx.createBiquadFilter();
	filter.type = 'bandpass';
	// A strong click is lower and louder: reads as a heavier "clunk".
	filter.frequency.value = strong ? 1800 : 3200;
	filter.Q.value = 1.2;
	const gain = ctx.createGain();
	gain.gain.value = strong ? 1 : 0.6;
	source.connect(filter).connect(gain).connect(ctx.destination);
	source.start();
}

function haptic(strong: boolean): void {
	if ('vibrate' in navigator) {
		navigator.vibrate(strong ? 18 : 8);
		return;
	}
	// iPhone: Safari has no vibrate(). On iOS 18+, toggling a native
	// <input type="checkbox" switch> plays the system haptic, so we keep an
	// invisible one around and flip it. Does nothing on other browsers.
	if (!iosSwitch) {
		iosSwitch = document.createElement('label');
		iosSwitch.setAttribute('aria-hidden', 'true');
		iosSwitch.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
		const input = document.createElement('input');
		input.type = 'checkbox';
		input.setAttribute('switch', '');
		input.tabIndex = -1;
		iosSwitch.appendChild(input);
		document.body.appendChild(iosSwitch);
	}
	iosSwitch.click();
}

/**
 * One click + one tap. Rate-limited so a fast fling doesn't turn into a buzz.
 * `strong` = a detent: heavier click, longer buzz.
 */
export function tick(strong = false): void {
	const now = performance.now();
	if (now - lastTick < 28) return;
	lastTick = now;
	if (soundOn) playClick(strong);
	if (hapticsOn) haptic(strong);
}

let lastBuzz = 0;

/**
 * Just the buzz, for toys that make their own sound. Rate-limited like
 * tick() (its own clock, so a toy's buzz never swallows an unlock tick):
 * a flung dial crosses a notch every frame, and that would be one long buzz.
 */
export function buzz(strong = false): void {
	const now = performance.now();
	if (now - lastBuzz < 28) return;
	lastBuzz = now;
	if (hapticsOn) haptic(strong);
}
