<script lang="ts">
	import '#lib/ui/brutal.css';
	import { initDevice } from '#lib/core/db.ts';
	import { listenForInstall } from '#lib/core/install.svelte.ts';
	import { loadTheme } from '#lib/core/theme.svelte.ts';
	import { loadCurrency } from '#lib/core/currency.svelte.ts';
	import { onNavigate } from '$app/navigation';
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
	loadTheme();
	loadCurrency();

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
