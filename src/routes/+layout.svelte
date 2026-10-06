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
	import { tools } from '#lib/apps.ts';
	import Curtain from '#lib/ui/transition/Curtain.svelte';
	import { curtain } from '#lib/ui/transition/state.svelte.ts';
	import { planFor } from '#lib/ui/transition/plan.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/*
	 * Every navigation plays the page curtain (lib/ui/transition): it
	 * covers the screen, the page swaps underneath, then it cracks open.
	 * iOS's own swipe-back already animates, so that one is left alone.
	 */
	let uaAnimated = false;
	$effect(() => {
		const onPop = (e: PopStateEvent) => {
			uaAnimated = !!(e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition;
		};
		addEventListener('popstate', onPop);
		return () => removeEventListener('popstate', onPop);
	});

	onNavigate((navigation) => {
		const plan = planFor({
			from: navigation.from?.url.pathname,
			to: navigation.to?.url.pathname,
			launch: curtain.take(),
			tools,
			reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
			uaAnimated: navigation.type === 'popstate' && uaAnimated,
			now: performance.now()
		});
		uaAnimated = false;
		if (!plan) return;
		const open = () => curtain.reveal();
		navigation.complete.then(open, open);
		return curtain.cover(plan);
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

<Curtain />
