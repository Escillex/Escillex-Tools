<script lang="ts">
	/**
	 * A two-option switch between hard lines. The active side gets the
	 * slanted tag. Tap either side, tap the active one to flip, or swipe.
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

<div class="switch" role="radiogroup" aria-label="Show" tabindex="-1" onkeydown={onKeyDown}>
	{#each options as label, i (label)}
		<button
			type="button"
			role="radio"
			aria-checked={value === i}
			class="display"
			onpointerdown={onPointerDown}
			onpointerup={(e) => onPointerUp(e, i)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (unlockFeedback(), set(i))}
		>
			<span class:tag={value === i}>{label}</span>
		</button>
	{/each}
</div>

<style>
	.switch {
		display: flex;
		justify-content: center;
		gap: 6px;
		touch-action: none;
		user-select: none;
	}
	button {
		border: 0;
		background: none;
		color: var(--dim);
		font-size: calc(1.75rem / var(--font-wide));
		letter-spacing: 0.02em;
		padding: 6px 4px;
		cursor: pointer;
	}
	button[aria-checked='true'] {
		color: var(--accent-ink);
	}
</style>
