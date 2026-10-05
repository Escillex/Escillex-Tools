<script lang="ts">
	import { initDevice } from '#lib/core/db.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	$effect(() => {
		initDevice();
	});
</script>

<svelte:head>
	<title>Tools</title>
	<link rel="icon" href="/icon.svg" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icon.svg" />
	<meta name="theme-color" content="#000000" />
</svelte:head>

{@render children()}
