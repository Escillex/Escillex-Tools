<script lang="ts">
	/** Yellowpad settings: the default view, and Yellowpad's own look over the global one. */
	import Sheet from '#lib/ui/Sheet.svelte';
	import ToolLookFields from '#lib/core/ToolLookFields.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import type { Mode } from '#lib/markdown/ModeTabs.svelte';
	import { openAsCopies, setOpenAsCopies } from './files';

	let { mode = $bindable(), onclose }: { mode: Mode; onclose: () => void } = $props();
	const MODES: Mode[] = ['read', 'write', 'raw', 'split'];

	let copies = $state(openAsCopies());
	function toggleCopies() {
		unlockFeedback();
		tick();
		copies = !copies;
		setOpenAsCopies(copies);
	}
</script>

<Sheet title="Yellowpad" {onclose}>
	<p class="label">Files open in</p>
	<div class="modes" role="radiogroup" aria-label="Files open in">
		{#each MODES as m (m)}
			<button
				type="button"
				role="radio"
				aria-checked={mode === m}
				class="display"
				onclick={() => {
					unlockFeedback();
					tick();
					mode = m;
				}}><span class:tag={mode === m}>{m}</span></button
			>
		{/each}
	</div>
	<p class="label">Split needs a wide window; on narrow screens it opens as Raw.</p>
	<p class="label">Files</p>
	<button type="button" class="switch" role="switch" aria-checked={copies} onclick={toggleCopies}>
		<span>Open files as copies</span>
		<span class="dot" class:on={copies}></span>
	</button>
	<p class="label">
		On: files open through a plain picker and saving downloads a copy. It turns on by itself in browsers that won't let the app
		read files directly. Only affects this browser. Applies to the next file you open.
	</p>

	<ToolLookFields />
</Sheet>

<style>
	.label {
		margin: 0;
	}
	.switch {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: none;
		border: 0;
		border-bottom: 2px solid var(--line);
		color: var(--ink);
		font-family: var(--font-read);
		font-style: normal;
		font-size: 1.05rem;
		padding: 8px 2px;
		cursor: pointer;
		text-align: left;
	}
	.dot {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--line);
		border-radius: 50%;
	}
	.dot.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.modes {
		display: flex;
		gap: 8px;
	}
	.modes button {
		border: 0;
		background: none;
		color: var(--dim);
		font-size: calc(1.6rem / var(--font-wide));
		cursor: pointer;
	}
	.modes button[aria-checked='true'] {
		color: var(--accent-ink);
	}
</style>
