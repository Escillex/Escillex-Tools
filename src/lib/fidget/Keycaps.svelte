<script lang="ts">
	/** Four mechanical keys, each its own switch type. Hold one down and it stays bottomed out. */
	import { unlockFeedback } from '#lib/ui/feedback.ts';
	import { KEY_SOUND, play } from './sounds';
	import type { Keys } from './toys';

	let { keys, onaction }: { keys: Keys; onaction: () => void } = $props();

	let down = $state<boolean[]>([false, false, false, false]);

	function press(i: number) {
		unlockFeedback();
		if (down[i]) return;
		down[i] = true;
		play(KEY_SOUND[keys[i]], keys[i] === 'spacebar' || keys[i] === 'thock');
		onaction();
	}
	const lift = (i: number) => (down[i] = false);
	const isKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';
</script>

<div class="keys">
	{#each keys as type, i (i)}
		<button
			type="button"
			class="key display"
			class:wide={type === 'spacebar'}
			class:down={down[i]}
			aria-label="{type} key"
			onpointerdown={() => press(i)}
			onpointerup={() => lift(i)}
			onpointerleave={() => lift(i)}
			onpointercancel={() => lift(i)}
			onkeydown={(e) => isKey(e) && !e.repeat && (e.preventDefault(), press(i))}
			onkeyup={(e) => isKey(e) && lift(i)}
		>
			<span>{type}</span>
		</button>
	{/each}
</div>

<style>
	/* Two keys a row; a spacebar takes a whole row, and a key left alone stretches to fill its row. */
	.keys {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		touch-action: manipulation;
	}
	.key {
		flex: 1 1 calc(50% - 5px);
		min-height: 7.5rem;
		border: 2px solid var(--line);
		border-bottom-width: 10px;
		background: var(--faint);
		color: var(--ink);
		font-size: calc(1.4rem / var(--font-wide));
		cursor: pointer;
		transition:
			transform 50ms,
			border-bottom-width 50ms;
	}
	.wide {
		flex-basis: 100%;
		min-height: 4.5rem;
	}
	/* Bottomed out: the cap drops by the height of its side. */
	.down {
		transform: translateY(8px);
		border-bottom-width: 2px;
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
