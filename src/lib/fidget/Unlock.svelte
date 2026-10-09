<script lang="ts">
	/** "FACT UNLOCKED": a bar with the new fact. Its label links to the collection. */
	import { fade, fly } from 'svelte/transition';
	import type { Fact } from './facts';

	let { fact }: { fact: Fact } = $props();

	const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	const slide = (node: Element) => (reduced ? fade(node, { duration: 160 }) : fly(node, { x: -640, duration: 280 }));
</script>

<div class="bar" role="status" transition:slide>
	<a class="label" href="/fidget/facts">Fact unlocked →</a>
	<span class="text">{fact.text}</span>
</div>

<style>
	/*
	 * It may cover the top of the toy, so the bar lets taps through; only
	 * its small label (over the loop) is a link. Mid-popping, the next tap
	 * still pops instead of leaving the page.
	 */
	.bar {
		position: fixed;
		left: 0;
		right: 12%;
		top: calc(62px + env(safe-area-inset-top, 0px));
		display: grid;
		gap: 4px;
		padding: 10px 28px 12px 16px;
		background: var(--accent);
		color: var(--accent-ink);
		/* The Persona slant on the trailing edge. */
		clip-path: polygon(0 0, 100% 0, calc(100% - 22px) 100%, 0 100%);
		z-index: 20;
		pointer-events: none;
	}
	.label {
		justify-self: start;
		color: inherit;
		text-decoration: none;
		pointer-events: auto;
	}
	.text {
		font-family: var(--font-read);
		font-size: 1rem;
		line-height: 1.3;
	}
</style>
