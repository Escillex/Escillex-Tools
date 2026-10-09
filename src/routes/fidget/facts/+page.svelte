<script lang="ts">
	/** The facts collection: what you've found, and ??? for the rest. */
	import { onMount } from 'svelte';
	import RollingNumber from '#lib/ui/RollingNumber.svelte';
	import { TRIVIA, untilNext } from '#lib/fidget/facts.ts';
	import { loadCounts } from '#lib/fidget/db.ts';

	let total = $state(0);
	let found = $state(new Set<string>());
	let ready = $state(false);

	onMount(async () => {
		const saved = await loadCounts();
		total = Object.values(saved.counts).reduce((s, n) => s + (n ?? 0), 0);
		found = new Set(saved.unlocked);
		ready = true;
	});

	const next = $derived(untilNext(total, found.size));
</script>

<svelte:head><title>FACTS · FIDGET</title></svelte:head>

<main class="screen">
	<header class="top">
		<a class="circle" href="/fidget" aria-label="Back to Fidget">←</a>
	</header>
	<h1 class="display"><span class="tag">Useless facts</span></h1>

	{#if ready}
		<div class="stats">
			<span class="big display"><RollingNumber value={total} /></span>
			<p class="label">
				{found.size} / {TRIVIA.length} found ·
				{next === null ? 'you found them all' : `next in ${next.toLocaleString('en-US')}`}
			</p>
		</div>

		<ol class="list">
			{#each TRIVIA as f, i (f.id)}
				<li class:locked={!found.has(f.id)}>
					<span class="label">{String(i + 1).padStart(2, '0')}</span>
					<span class="text">{found.has(f.id) ? f.text : '???'}</span>
				</li>
			{/each}
		</ol>
	{/if}
</main>

<style>
	.screen {
		box-sizing: border-box;
		min-height: 100dvh;
		max-width: 620px;
		margin: 0 auto;
		display: grid;
		gap: 14px;
		align-content: start;
		padding: calc(14px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
	}
	h1 {
		margin: 0;
		font-size: calc(2.6rem / var(--font-wide));
	}
	h1 .tag {
		display: block;
	}
	.stats {
		display: grid;
		justify-items: start;
	}
	.big {
		font-size: calc(4.5rem / var(--font-wide));
		line-height: 1;
	}
	.stats .label {
		margin: 0;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.list li {
		display: grid;
		grid-template-columns: 2.4rem 1fr;
		gap: 8px;
		padding: 10px 0;
		border-bottom: 2px solid var(--line);
	}
	.text {
		font-family: var(--font-read);
		line-height: 1.35;
	}
	.locked .text {
		color: var(--dim);
		font-family: var(--font-mono);
	}
</style>
