<script lang="ts">
	/** A wall of chunky toggles. Each flip counts. */
	import { unlockFeedback } from '#lib/ui/feedback.ts';
	import { play } from './sounds';

	let { count, onaction }: { count: number; onaction: () => void } = $props();

	let on = $state<boolean[]>([]);
	// A new count starts with every switch off.
	$effect(() => {
		on = Array.from({ length: count }, () => false);
	});

	function flip(i: number) {
		unlockFeedback();
		on[i] = !on[i];
		play('flip', true);
		onaction();
	}
</script>

<div class="wall" style:--cols={count === 4 ? 2 : 3}>
	{#each on as isOn, i (i)}
		<button
			type="button"
			class="switch"
			class:on={isOn}
			role="switch"
			aria-checked={isOn}
			aria-label="Switch {i + 1}"
			onpointerdown={() => flip(i)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && (e.preventDefault(), flip(i))}
		>
			<span class="lever"></span>
		</button>
	{/each}
</div>

<style>
	.wall {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: 12px;
		touch-action: manipulation;
	}
	.switch {
		position: relative;
		aspect-ratio: 0.6;
		border: 2px solid var(--line);
		background: none;
		cursor: pointer;
	}
	.switch:active {
		transform: scale(0.96);
	}
	.lever {
		position: absolute;
		left: 12%;
		right: 12%;
		height: 42%;
		bottom: 6%;
		background: var(--faint);
		border: 2px solid var(--line);
		transition: bottom 70ms;
	}
	.on .lever {
		bottom: 52%;
		background: var(--accent);
		border-color: var(--accent);
	}
	@media (prefers-reduced-motion: reduce) {
		.lever {
			transition: none;
		}
	}
</style>
