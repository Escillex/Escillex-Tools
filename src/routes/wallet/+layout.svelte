<script lang="ts">
	/*
	 * Everything under /wallet (the main screen, Manage, Calendar) takes on
	 * the selected wallet's colors: the whole page, not just one screen.
	 * Leaving Wallet hands the colors back to the app.
	 */
	import { live } from '#lib/live.svelte.ts';
	import { listWallets } from '#lib/finance/data.ts';
	import { selection } from '#lib/finance/selection.svelte.ts';
	import { walletPalette } from '#lib/finance/walletTheme.ts';
	import { appPalette, overridePalette } from '#lib/core/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const wallets = live(listWallets, []);

	$effect(() => {
		const w = wallets.current.find((x) => x.id === selection.id);
		overridePalette(walletPalette(w, appPalette()));
	});
	$effect(() => () => overridePalette(null));
</script>

{@render children()}
