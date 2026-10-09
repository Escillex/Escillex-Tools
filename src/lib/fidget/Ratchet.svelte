<script lang="ts">
	/**
	 * A knob that clicks at each detent. Drag round it (or fling it and let
	 * it spin down); arrow keys turn it one click. Uses the same detent
	 * physics as the launcher dial, with one notch per click.
	 */
	import { untrack } from 'svelte';
	import { Detent } from '#lib/ui/detent.svelte.ts';
	import { unlockFeedback } from '#lib/ui/feedback.ts';
	import { play } from './sounds';
	import { turnDelta } from './mechanics';

	let { detents, onaction }: { detents: number; onaction: () => void } = $props();

	const detent = new Detent(0, {
		onNotch: () => {
			play('ratchet');
			onaction();
		}
	});

	// A fling still settling when you switch toy would keep clicking (and counting) for the next one.
	$effect(() => () => detent.stop());

	// A new click count starts the knob from the top again.
	$effect(() => {
		detents;
		untrack(() => detent.jump(0));
	});

	const laps = $derived(Math.floor(Math.abs(detent.rounded) / detents));

	let knob: HTMLDivElement;
	let dragging = false;
	let angle = 0;

	const angleOf = (e: PointerEvent) => {
		const r = knob.getBoundingClientRect();
		return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
	};

	function down(e: PointerEvent) {
		unlockFeedback();
		knob.setPointerCapture(e.pointerId);
		dragging = true;
		angle = angleOf(e);
		detent.grab();
	}
	function move(e: PointerEvent) {
		if (!dragging) return;
		const next = angleOf(e);
		detent.moveTo(detent.pos + turnDelta(angle, next) * detents);
		angle = next;
	}
	function up() {
		if (!dragging) return;
		dragging = false;
		detent.release();
	}
	function key(e: KeyboardEvent) {
		const step = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
		if (!step) return;
		e.preventDefault();
		unlockFeedback();
		detent.animateTo(detent.rounded + step);
	}
</script>

<div class="ratchet">
	<div
		class="knob"
		bind:this={knob}
		role="button"
		tabindex="0"
		aria-label="Ratchet dial. Drag round it, or use the arrow keys."
		style:--turn="{(detent.pos / detents) * 360}deg"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
		onkeydown={key}
	>
		{#each { length: detents } as _, i (i)}
			<i style:--a="{(i / detents) * 360}deg"></i>
		{/each}
		<span class="mark"></span>
	</div>
	<p class="label">Lap {laps}</p>
</div>

<style>
	.ratchet {
		display: grid;
		justify-items: center;
		gap: 8px;
	}
	.knob {
		position: relative;
		width: min(70vw, 280px);
		aspect-ratio: 1;
		border: 2px solid var(--line);
		border-radius: 50%;
		background: var(--faint);
		transform: rotate(var(--turn));
		touch-action: none;
		cursor: grab;
	}
	.knob i {
		position: absolute;
		left: 50%;
		top: 0;
		width: 2px;
		height: 50%;
		margin-left: -1px;
		transform-origin: bottom;
		transform: rotate(var(--a));
		background: linear-gradient(var(--line) 0 9%, transparent 9%);
	}
	.mark {
		position: absolute;
		left: 50%;
		top: 14%;
		width: 14px;
		height: 22%;
		margin-left: -7px;
		background: var(--accent);
	}
</style>
