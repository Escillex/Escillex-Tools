/**
 * Each toy's own sound, made in code (no audio files): either a short
 * burst of filtered noise (clicks, clacks) or a falling tone (pops,
 * thunks). Plays through feedback.ts, so Settings → Sound / Haptics apply.
 */
import { audio, buzz } from '#lib/ui/feedback.ts';
import type { SwitchType } from './toys';

export type SoundId = 'pop' | 'clicky' | 'tactile' | 'linear' | 'thock' | 'spacebar' | 'ratchet' | 'flip' | 'penDown' | 'penUp' | 'notch' | 'thunk';

export interface Recipe {
	kind: 'noise' | 'tone';
	ms: number;
	/** Noise: the band's centre. Tone: the start pitch. */
	freq: number;
	/** Tone only: the pitch it falls to. */
	to?: number;
	/** Noise only: how narrow the band is (higher = more "tick", less "hiss"). */
	q?: number;
	gain: number;
}

export const RECIPES: Record<SoundId, Recipe> = {
	pop: { kind: 'tone', ms: 45, freq: 900, to: 180, gain: 0.7 },
	clicky: { kind: 'noise', ms: 14, freq: 4200, q: 1.6, gain: 0.9 },
	tactile: { kind: 'noise', ms: 18, freq: 2400, q: 1.2, gain: 0.6 },
	linear: { kind: 'noise', ms: 22, freq: 1400, q: 0.9, gain: 0.45 },
	thock: { kind: 'tone', ms: 60, freq: 220, to: 120, gain: 0.8 },
	spacebar: { kind: 'noise', ms: 40, freq: 700, q: 0.8, gain: 0.9 },
	ratchet: { kind: 'noise', ms: 8, freq: 5200, q: 2, gain: 0.5 },
	flip: { kind: 'noise', ms: 16, freq: 2000, q: 1.4, gain: 0.8 },
	penDown: { kind: 'noise', ms: 12, freq: 3600, q: 1.8, gain: 0.8 },
	penUp: { kind: 'noise', ms: 10, freq: 2800, q: 1.8, gain: 0.55 },
	notch: { kind: 'noise', ms: 8, freq: 3000, q: 1.5, gain: 0.45 },
	thunk: { kind: 'tone', ms: 80, freq: 160, to: 70, gain: 1 }
};

export const KEY_SOUND: Record<SwitchType, SoundId> = {
	clicky: 'clicky',
	tactile: 'tactile',
	linear: 'linear',
	thock: 'thock',
	spacebar: 'spacebar'
};

let noiseBuffer: AudioBuffer | null = null;

/** 120ms of white noise, made once; every noise sound plays the start of it. */
function noise(ctx: AudioContext): AudioBuffer {
	if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
	const length = Math.floor(ctx.sampleRate * 0.12);
	noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
	const data = noiseBuffer.getChannelData(0);
	for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
	return noiseBuffer;
}

/** The toy's sound (if Sound is on) and a buzz (if Haptics is on). `strong` = a heavier buzz. */
export function play(id: SoundId, strong = false): void {
	buzz(strong);
	const ctx = audio();
	if (!ctx) return;
	const r = RECIPES[id];
	const start = ctx.currentTime;
	const end = start + r.ms / 1000;

	const gain = ctx.createGain();
	gain.gain.setValueAtTime(r.gain, start);
	gain.gain.exponentialRampToValueAtTime(0.001, end);
	gain.connect(ctx.destination);

	if (r.kind === 'tone') {
		const osc = ctx.createOscillator();
		osc.frequency.setValueAtTime(r.freq, start);
		if (r.to) osc.frequency.exponentialRampToValueAtTime(r.to, end);
		osc.connect(gain);
		osc.start(start);
		osc.stop(end);
	} else {
		const source = ctx.createBufferSource();
		source.buffer = noise(ctx);
		const filter = ctx.createBiquadFilter();
		filter.type = 'bandpass';
		filter.frequency.value = r.freq;
		filter.Q.value = r.q ?? 1;
		source.connect(filter).connect(gain);
		source.start(start);
		source.stop(end);
	}
}
