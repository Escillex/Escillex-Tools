<script lang="ts">
	import { live } from '#lib/live.svelte.ts';
	import { budgetSummary, listBudgets, listWallets, walletBalances } from '#lib/finance/data.ts';
	import Calendar from '#lib/finance/Calendar.svelte';

	const wallets = live(listWallets, []);
	const balances = live(walletBalances, {});
	const summary = live(budgetSummary, null);
	const budgets = live(listBudgets, []);
</script>

<svelte:head>
	<title>Calendar · Wallet</title>
</svelte:head>

<!-- Wait for the budget: Calendar copies it once into its editable draft. -->
{#if summary.loaded && wallets.loaded && budgets.loaded}
	<Calendar wallets={wallets.current} balances={balances.current} budget={summary.current?.budget ?? null} budgets={budgets.current} />
{/if}
