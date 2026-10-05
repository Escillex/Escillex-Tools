<script lang="ts">
	import { live } from '#lib/live.svelte.ts';
	import { budgetSummary, listWallets, walletBalances } from '#lib/finance/data.ts';
	import Manage from '#lib/finance/Manage.svelte';

	const wallets = live(listWallets, []);
	const balances = live(walletBalances, {});
	const summary = live(budgetSummary, null);
</script>

<svelte:head>
	<title>Manage · Wallet</title>
</svelte:head>

<!-- Wait for the budget: Manage copies it once into its editable form. -->
{#if summary.loaded && wallets.loaded}
	<Manage wallets={wallets.current} balances={balances.current} budget={summary.current?.budget ?? null} />
{/if}
