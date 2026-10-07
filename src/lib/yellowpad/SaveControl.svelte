<script lang="ts">
	/**
	 * Save, always in sight. Manual: [SAVE] lights up when there's unsaved
	 * work. Auto: a status label instead (Saving… / Saved ✓). The AUTO
	 * switch next to it flips between the two.
	 */
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import type { Saver } from './saver.svelte';

	let { saver, inPlace, onsave, onauto }: { saver: Saver; inPlace: boolean; onsave: () => void; onauto: (on: boolean) => void } = $props();

	const label = $derived(
		{ idle: 'Saved ✓', dirty: 'Unsaved', saving: 'Saving…', saved: 'Saved ✓', failed: 'Save failed' }[saver.status]
	);
</script>

<div class="save">
	{#if saver.auto && inPlace}
		{#if saver.status === 'failed'}
			<button type="button" class="btn btn-danger small" onclick={onsave}>Retry</button>
		{:else}
			<span class="label status">{label}</span>
		{/if}
	{:else}
		<button
			type="button"
			class="btn small"
			class:btn-primary={saver.pending}
			class:btn-danger={saver.status === 'failed'}
			onclick={() => (unlockFeedback(), onsave())}
		>
			{saver.status === 'failed' ? 'Retry' : inPlace ? 'Save' : 'Download'}
		</button>
	{/if}
	{#if inPlace}
		<button
			type="button"
			class="auto label"
			role="switch"
			aria-checked={saver.auto}
			onclick={() => {
				unlockFeedback();
				tick();
				onauto(!saver.auto);
			}}
		>
			Auto <span class="dot" class:on={saver.auto}></span>
		</button>
	{/if}
</div>

<style>
	.save {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.small {
		font-size: 0.95rem;
		padding: 6px 14px;
	}
	.status {
		min-width: 5.5em;
		text-align: right;
		color: var(--ink);
	}
	.auto {
		display: flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: 0;
		cursor: pointer;
		color: var(--ink);
	}
	.dot {
		width: 0.8rem;
		height: 0.8rem;
		border: 2px solid var(--line);
		border-radius: 50%;
	}
	.dot.on {
		background: var(--accent);
		border-color: var(--accent);
	}
</style>
