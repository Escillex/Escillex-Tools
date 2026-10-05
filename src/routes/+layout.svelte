<script lang="ts">
	import '#lib/ui/brutal.css';
	import { initDevice } from '#lib/core/db.ts';
	import { install, listenForInstall } from '#lib/core/install.svelte.ts';
	import InstallGate from '#lib/core/InstallGate.svelte';
	import { listenForUpdates } from '#lib/core/update.svelte.ts';
	import { loadTheme } from '#lib/core/theme.svelte.ts';
	import { loadCurrency } from '#lib/core/currency.svelte.ts';
	import { onNavigate } from '$app/navigation';
	import { dev } from '$app/env';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/*
	 * Push/pop page animation. The browser screenshots the old page, we swap
	 * in the new one, and CSS (brutal.css) slides between the two. Going to
	 * a deeper path (/wallet → /wallet/manage) pushes forward; shallower pops back.
	 */
	onNavigate((navigation) => {
		if (!document.startViewTransition) return; // older browsers: just switch pages
		const depth = (path = '/') => path.split('/').filter(Boolean).length;
		const from = depth(navigation.from?.url.pathname);
		const to = depth(navigation.to?.url.pathname);
		document.documentElement.dataset.nav = to > from ? 'forward' : to < from ? 'back' : 'same';

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});

	// Start listening right away: the browser may offer installation before
	// the launcher page has even finished loading.
	listenForInstall();
	listenForUpdates();
	loadTheme();
	loadCurrency();

	$effect(() => {
		initDevice();
	});
</script>

<svelte:head>
	<title>Tools</title>
	<link rel="icon" type="image/png" href="/favicon.png" />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	<meta name="theme-color" content="#000000" />
</svelte:head>

<!-- Safari only gets the app once it's installed. Not in `npm run dev`, so Safari can still be used to develop. -->
{#if install.mustInstall && !dev}
	<InstallGate />
{:else}
	{@render children()}
{/if}
