<script lang="ts">
	import '@fontsource-variable/big-shoulders-display';
	import '#lib/ui/glass.css';
	import { flushSync } from 'svelte';
	import { live } from '#lib/live.svelte.ts';
	import {
		budgetSummary,
		isInBudget,
		listWallets,
		logExpense,
		logIncome,
		toCentavos,
		walletBalances
	} from '#lib/finance/data.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import Setup from '#lib/finance/Setup.svelte';
	import Entry from '#lib/finance/Entry.svelte';
	import Manage from '#lib/finance/Manage.svelte';
	import WalletLoop from '#lib/ui/WalletLoop.svelte';
	import ModeSwitch from '#lib/ui/ModeSwitch.svelte';
	import RollingNumber from '#lib/ui/RollingNumber.svelte';

	const wallets = live(listWallets, []);
	const summary = live(budgetSummary, null);
	const balances = live(walletBalances, {});

	let mode = $state(0); // 0 = allowance, 1 = total budget
	let selected = $state(0);
	let managing = $state(false);

	function openManage() {
		unlockFeedback();
		tick();
		managing = true;
	}

	// "All" first, then every wallet. The loop wraps around forever.
	const items = $derived([{ id: 'all', label: 'All' }, ...wallets.current.map((w) => ({ id: w.id, label: w.name }))]);

	/** The centered wallet is exempt: it has no allowance, so show its balance instead. */
	const exempt = $derived.by(() => {
		const id = items[selected]?.id;
		const budget = summary.current?.budget;
		return !!id && id !== 'all' && !!budget && !isInBudget(budget, id);
	});

	const value = $derived.by(() => {
		const id = items[selected]?.id ?? 'all';
		if (exempt) return (balances.current[id] ?? 0) / 100;
		const n = summary.current?.byWallet[id];
		if (!n) return 0;
		return (mode === 0 ? n.allowance : n.remaining) / 100;
	});

	const ready = $derived(wallets.loaded && summary.loaded);
	const needsSetup = $derived(ready && (wallets.current.length === 0 || !summary.current));

	/* ---------- logging ---------- */
	let entry = $state<{ initial: string } | null>(null);
	const selectedWallet = $derived(selected === 0 ? null : (wallets.current[selected - 1] ?? null));
	const selectedBalance = $derived(
		selectedWallet
			? (balances.current[selectedWallet.id] ?? 0)
			: wallets.current.reduce((sum, w) => sum + (balances.current[w.id] ?? 0), 0)
	);

	function openEntry(initial = '') {
		unlockFeedback();
		entry = { initial };
		// Render the entry screen right now, inside this tap, so its input can
		// take focus. Phones only open the keyboard during a real user gesture.
		flushSync();
	}

	// PC: start typing a number (or + / -) anywhere to open the entry screen.
	function onWindowKey(e: KeyboardEvent) {
		if (entry || managing || needsSetup || !ready) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.target instanceof HTMLInputElement) return;
		if (/^[0-9.+-]$/.test(e.key)) {
			e.preventDefault();
			openEntry(e.key);
		}
	}

	async function onLog(amount: number, sign: 1 | -1) {
		const wallet = selectedWallet;
		entry = null;
		if (!wallet) return;
		const centavos = toCentavos(amount);
		const budget = summary.current?.budget;
		const counts = !budget || isInBudget(budget, wallet.id); // exempt wallets don't eat the allowance
		if (sign === -1) await logExpense({ walletId: wallet.id, amount: centavos, note: '', countsTowardBudget: counts });
		else await logIncome({ walletId: wallet.id, amount: centavos });
		tick();
	}
</script>

<svelte:window onkeydown={onWindowKey} />

<svelte:head>
	<title>Wallet</title>
	<meta name="theme-color" content="#000000" />
</svelte:head>

<div class="screen">
	<a class="back" href="/" aria-label="Back to tools">←</a>

	{#if needsSetup}
		<Setup wallets={wallets.current} />
	{:else if ready}
		<div class="top">
			<ModeSwitch options={['ALLOWANCE', 'TOTAL BUDGET']} bind:value={mode} />
		</div>

		<div class="center">
			<div class="wallets">
				<WalletLoop {items} bind:selected />
			</div>
			<button class="big" class:exempt type="button" onclick={() => openEntry()} aria-label="Log an amount">
				<RollingNumber {value} />
			</button>
			<p class="exempt-note" class:shown={exempt}>NOT IN BUDGET · BALANCE</p>
		</div>

		<div class="bottom">
			<button class="manage glass" type="button" onclick={openManage}>Manage</button>
			{#if summary.current}
				<p class="meta">
					{#if summary.current.day > summary.current.budget.days}
						Budget ended
					{:else if summary.current.day < 1}
						Starts {summary.current.budget.startDate}
					{:else}
						Day {summary.current.day} of {summary.current.budget.days}
					{/if}
				</p>
			{/if}
		</div>
	{/if}

	{#if managing}
		<Manage
			wallets={wallets.current}
			balances={balances.current}
			budget={summary.current?.budget ?? null}
			onclose={() => (managing = false)}
		/>
	{/if}

	{#if entry}
		<Entry
			initial={entry.initial}
			{items}
			bind:selected
			walletName={selectedWallet?.name ?? null}
			balance={selectedBalance}
			onsubmit={onLog}
			oncancel={() => (entry = null)}
		/>
	{/if}
</div>

<style>
	:global(body) {
		margin: 0;
		background: #000;
	}
	.screen {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 16px;
		box-sizing: border-box;
		background: #000;
		color: #fff;
		font-family: 'Big Shoulders Display Variable', 'Arial Narrow', sans-serif;
		font-size: 18px;
		overflow: hidden;
	}
	.back {
		position: absolute;
		top: calc(16px + env(safe-area-inset-top, 0px));
		left: 16px;
		color: #555;
		text-decoration: none;
		font-size: 1.5rem;
		padding: 4px 8px;
	}
	.top {
		position: absolute;
		top: calc(56px + env(safe-area-inset-top, 0px));
	}
	.center {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 520px;
	}
	.wallets {
		width: 100%;
		font-size: 1.6rem;
		font-weight: 700;
	}
	.big {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		font-size: clamp(6rem, 34vw, 12rem);
		font-weight: 800;
		letter-spacing: -0.01em;
		margin-top: -0.04em;
	}
	.big {
		transition: color 250ms;
	}
	.big.exempt {
		color: #4a4a4a;
	}
	/* Always takes up space (just invisible) so the number doesn't jump when it appears. */
	.exempt-note {
		margin: 4px 0 0;
		color: #4a4a4a;
		letter-spacing: 0.1em;
		opacity: 0;
		transition: opacity 250ms;
	}
	.exempt-note.shown {
		opacity: 1;
	}
	.bottom {
		position: absolute;
		bottom: calc(24px + env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.manage {
		font: inherit;
		font-size: 1.05rem;
		letter-spacing: 0.1em;
		padding: 10px 30px;
		border-radius: 999px;
		cursor: pointer;
		transition: transform 120ms;
	}
	.manage:active {
		transform: scale(0.96);
	}
	.meta {
		margin: 0;
		color: #4a4a4a;
		letter-spacing: 0.08em;
	}
</style>
