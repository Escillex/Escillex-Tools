<script lang="ts">
	/** A notched slider: a click at each notch, a heavy thunk at either end. Each notch counts. */
	import { unlockFeedback } from '#lib/ui/feedback.ts';
	import { play } from './sounds';
	import { isEnd, notchAt } from './mechanics';

	let { notches, onaction }: { notches: number; onaction: () => void } = $props();

	let notch = $state(0);
	// A new notch count starts from the left end.
	$effect(() => {
		notches;
		notch = 0;
	});

	let track: HTMLDivElement;
	let dragging = false;

	function goTo(next: number) {
		if (next === notch) return;
		// A fast drag can skip notches: click once for each one crossed.
		const step = next > notch ? 1 : -1;
		while (notch !== next) {
			notch += step;
			play(isEnd(notch, notches) ? 'thunk' : 'notch', isEnd(notch, notches));
			onaction();
		}
	}
	const fractionOf = (e: PointerEvent) => {
		const r = track.getBoundingClientRect();
		return (e.clientX - r.left) / r.width;
	};
	function down(e: PointerEvent) {
		unlockFeedback();
		track.setPointerCapture(e.pointerId);
		dragging = true;
		goTo(notchAt(fractionOf(e), notches));
	}
	function move(e: PointerEvent) {
		if (dragging) goTo(notchAt(fractionOf(e), notches));
	}
	function key(e: KeyboardEvent) {
		const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
		if (!step) return;
		e.preventDefault();
		unlockFeedback();
		goTo(Math.min(notches - 1, Math.max(0, notch + step)));
	}
</script>

<div
	class="track"
	bind:this={track}
	role="slider"
	tabindex="0"
	aria-label="Notched slider"
	aria-valuemin={0}
	aria-valuemax={notches - 1}
	aria-valuenow={notch}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={() => (dragging = false)}
	onpointercancel={() => (dragging = false)}
	onkeydown={key}
>
	{#each { length: notches } as _, i (i)}
		<i style:left="{(i / (notches - 1)) * 100}%"></i>
	{/each}
	<span class="thumb" style:left="{(notch / (notches - 1)) * 100}%"></span>
</div>

<style>
	.track {
		position: relative;
		height: 5rem;
		margin: 0 1.5rem;
		touch-action: none;
		cursor: pointer;
	}
	.track::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		border-top: 2px solid var(--line);
	}
	i {
		position: absolute;
		top: 30%;
		height: 40%;
		border-left: 2px solid var(--dim);
	}
	.thumb {
		position: absolute;
		top: 12%;
		width: 2.4rem;
		height: 76%;
		margin-left: -1.2rem;
		background: var(--accent);
		border: 2px solid var(--line);
		transform: skewX(-12deg);
		transition: left 60ms;
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>
