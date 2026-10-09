<script lang="ts">
	/** Bubble wrap: tap a bubble to pop it. Clear the whole sheet and a fresh one flings in. */
	import { fly, fade } from 'svelte/transition';
	import { unlockFeedback } from '#lib/ui/feedback.ts';
	import { play } from './sounds';
	import { GRIDS, type GridSize } from './toys';
	import { allPopped, newSheet } from './mechanics';

	let { grid, onaction }: { grid: GridSize; onaction: () => void } = $props();

	const dims = $derived(GRIDS[grid]);
	let sheet = $state<boolean[]>([]);
	/** Bumped for each fresh sheet, so the {#key} block plays its fling. */
	let round = $state(0);

	// A new grid size starts a fresh sheet.
	$effect(() => {
		sheet = newSheet(dims[0] * dims[1]);
	});

	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const enter = (node: Element) => (reduced ? fade(node, { duration: 160 }) : fly(node, { x: 420, duration: 260 }));

	function pop(i: number) {
		unlockFeedback();
		if (sheet[i]) return;
		sheet[i] = true;
		play('pop');
		onaction();
		if (allPopped(sheet)) {
			const size = sheet.length;
			setTimeout(() => {
				sheet = newSheet(size);
				round++;
			}, 350);
		}
	}
</script>

{#key round}
	<div class="sheet" style:--cols={dims[0]} in:enter>
		<!-- Popped bubbles are aria-disabled, not disabled: disabling the focused button would drop keyboard focus to the page. -->
		{#each sheet as popped, i (i)}
			<button
				type="button"
				class="bubble"
				class:popped
				aria-label={popped ? 'Popped' : 'Bubble'}
				aria-disabled={popped}
				onpointerdown={() => pop(i)}
				onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && (e.preventDefault(), pop(i))}
			></button>
		{/each}
	</div>
{/key}

<style>
	.sheet {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: 6px;
		touch-action: manipulation;
	}
	.bubble {
		aspect-ratio: 1;
		border: 2px solid var(--line);
		border-radius: 50%;
		background: var(--faint);
		cursor: pointer;
		transition: transform 80ms;
	}
	.bubble:active {
		transform: scale(0.9);
	}
	.popped {
		background: none;
		border-style: dashed;
		border-color: var(--dim);
		transform: scale(0.82);
		cursor: default;
	}
</style>
