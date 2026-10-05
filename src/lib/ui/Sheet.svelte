<script lang="ts">
	/**
	 * A panel that slides up from the bottom: solid black, a hard line on
	 * top, square corners. Used for short tasks like Sync and Style.
	 */
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop" transition:fade={{ duration: 160 }} onclick={onclose} aria-hidden="true"></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label={title} transition:fly={{ y: 600, duration: 320, easing: cubicOut }}>
	<header>
		<h2 class="display">{title}</h2>
		<button class="circle" type="button" onclick={onclose} aria-label="Close">✕</button>
	</header>
	<div class="body">
		{@render children()}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgb(0 0 0 / 0.75);
	}
	.sheet {
		position: fixed;
		z-index: 21;
		left: 50%;
		bottom: 0;
		translate: -50% 0;
		width: min(100%, 560px);
		max-height: 88dvh;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		border-top: 2px solid var(--line);
		padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
		font-size: calc(1.15rem / var(--font-wide));
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: calc(2.8rem / var(--font-wide));
	}
	.body {
		overflow-y: auto;
		padding: 14px 2px 4px;
		display: grid;
		gap: 12px;
		align-content: start;
	}
</style>
