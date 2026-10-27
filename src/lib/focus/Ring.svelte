<script lang="ts">
	/** The countdown: big digits inside a ring that drains as the phase runs. */
	import type { Phase } from './engine';

	let { left, total, phase, round, every, waiting, paused }: { left: number; total: number; phase: Phase; round: number; every: number; waiting: boolean; paused: boolean } =
		$props();

	const R = 46;
	const C = 2 * Math.PI * R;
	const share = $derived(total > 0 ? left / total : 0);
	const secs = $derived(Math.ceil(left / 1000));
	const digits = $derived(`${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`);
	const name = $derived(phase === 'focus' ? `Focus ${round}/${every}` : phase === 'break' ? 'Break' : 'Long break');
</script>

<div class="ring" role="timer" aria-label="{name}, {digits} left">
	<svg viewBox="0 0 100 100" aria-hidden="true">
		<circle class="track" cx="50" cy="50" r={R} />
		<circle class="left" class:rest={phase !== 'focus'} cx="50" cy="50" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - share)} />
	</svg>
	<div class="face">
		<span class="digits display">{digits}</span>
		<span class="label">{name}{waiting ? ' · press start' : paused ? ' · paused' : ''}</span>
	</div>
</div>

<style>
	.ring {
		position: relative;
		width: min(100%, 340px);
		aspect-ratio: 1;
		justify-self: center;
	}
	svg {
		width: 100%;
		height: 100%;
		/* Start the ring at 12 o'clock. */
		transform: rotate(-90deg);
	}
	circle {
		fill: none;
		stroke-width: 5;
	}
	.track {
		stroke: var(--faint);
	}
	.left {
		stroke: var(--accent);
		transition: stroke-dashoffset 1s linear;
	}
	.left.rest {
		stroke: var(--ink);
	}
	@media (prefers-reduced-motion: reduce) {
		.left {
			transition: none;
		}
	}
	.face {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 4px;
	}
	.digits {
		font-size: calc(5rem / var(--font-wide));
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
</style>
