<script lang="ts">
	// The launcher: tools.escillex.com opens here. One big word per tool.
	import '@fontsource-variable/big-shoulders-display';
	import { tools } from '#lib/apps.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
</script>

<svelte:head>
	<meta name="theme-color" content="#000000" />
</svelte:head>

<nav class="screen">
	{#each tools as tool (tool.id)}
		<a href={tool.href} onpointerdown={() => (unlockFeedback(), tick())}>{tool.name}</a>
	{/each}
</nav>

<style>
	:global(body) {
		margin: 0;
		background: #000;
	}
	.screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.2em;
		background: #000;
		font-family: 'Big Shoulders Display Variable', 'Arial Narrow', sans-serif;
	}
	a {
		color: #fff;
		text-decoration: none;
		font-size: clamp(5rem, 28vw, 11rem);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.01em;
		transition:
			transform 150ms,
			opacity 150ms;
	}
	a:active {
		transform: scale(0.96);
		opacity: 0.7;
	}
	a:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 8px;
	}
</style>
