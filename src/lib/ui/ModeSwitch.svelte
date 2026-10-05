<script lang="ts">
	/**
	 * A two-position glass switch with a sliding thumb. Tap either side, tap
	 * the active side to flip, or swipe across it. Ticks on every change.
	 */
	import { tick, unlockFeedback } from './feedback';

	let {
		options,
		value = $bindable(0)
	}: {
		options: [string, string];
		value?: number;
	} = $props();

	function set(i: number) {
		if (i === value) return;
		value = i;
		tick();
	}

	let startX = 0;
	function onPointerDown(e: PointerEvent) {
		unlockFeedback();
		startX = e.clientX;
	}
	function onPointerUp(e: PointerEvent, i: number) {
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 20) set(dx > 0 ? 1 : 0); // swipe
		else set(i === value ? 1 - value : i); // tap
	}
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') set(0);
		if (e.key === 'ArrowRight') set(1);
	}
</script>

<div class="switch glass" role="radiogroup" aria-label="Show" tabindex="-1" onkeydown={onKeyDown}>
	<span class="thumb glass-raised" style:transform="translateX({value * 100}%)"></span>
	{#each options as label, i (label)}
		<button
			type="button"
			role="radio"
			aria-checked={value === i}
			class:on={value === i}
			onpointerdown={onPointerDown}
			onpointerup={(e) => onPointerUp(e, i)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (unlockFeedback(), set(i))}
		>
			{label}
		</button>
	{/each}
</div>

<style>
	.switch {
		position: relative;
		display: grid;
		grid-template-columns: 1fr 1fr;
		padding: 4px;
		border-radius: 999px;
		touch-action: none;
		user-select: none;
	}
	.thumb {
		position: absolute;
		top: 4px;
		left: 4px;
		width: calc(50% - 4px);
		height: calc(100% - 8px);
		box-sizing: border-box;
		border-radius: 999px;
		transition: transform 280ms cubic-bezier(0.3, 1.3, 0.5, 1);
	}
	button {
		position: relative;
		z-index: 1;
		border: 0;
		background: none;
		color: rgb(255 255 255 / 0.45);
		font: inherit;
		letter-spacing: 0.08em;
		padding: 8px 18px;
		cursor: pointer;
		transition: color 200ms;
	}
	button.on {
		color: #fff;
	}
	button:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
		border-radius: 999px;
	}
	@media (prefers-reduced-motion: reduce) {
		.thumb {
			transition: none;
		}
	}
</style>
