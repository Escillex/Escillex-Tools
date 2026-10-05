<script lang="ts">
	/**
	 * First-run setup, in the same black style. Step 1 adds wallets (skipped
	 * if some exist), step 2 sets the budget and how it splits across them.
	 */
	import type { Wallet } from './db';
	import { createWallet, saveBudget, toCentavos, todayKey, walletBalances } from './data';
	import { live } from '#lib/live.svelte.ts';
	import { CURRENCIES, currencyName, formatMoney, money, setCurrency, type Currency } from '#lib/core/currency.svelte.ts';

	let { wallets, ondone }: { wallets: Wallet[]; ondone?: () => void } = $props();

	type Row = { name: string; amount: number | null };
	let rows = $state<Row[]>([
		{ name: 'Cash', amount: null },
		{ name: 'Bank', amount: null }
	]);

	let step = $state<'wallets' | 'budget'>('wallets');
	$effect.pre(() => {
		if (wallets.length > 0 && step === 'wallets') step = 'budget';
	});

	let total = $state<number | null>(null);
	let days = $state<number | null>(14);
	let split = $state<Record<string, number>>({});

	// Split evenly whenever the wallet list changes; the last wallet takes the rounding leftover.
	$effect.pre(() => {
		const ids = wallets.map((w) => w.id);
		if (ids.length === 0 || ids.every((id) => id in split)) return;
		const even = Math.floor(100 / ids.length);
		split = Object.fromEntries(ids.map((id, i) => [id, i === ids.length - 1 ? 100 - even * (ids.length - 1) : even]));
	});

	const splitTotal = $derived(Object.values(split).reduce((a, b) => a + (Number(b) || 0), 0));

	// Balance constraint: the budget can't be more than the in-budget wallets hold together.
	const balances = live(walletBalances, {});
	const held = $derived(wallets.reduce((s, w) => s + ((Number(split[w.id]) || 0) > 0 ? (balances.current[w.id] ?? 0) : 0), 0));
	const walletError = $derived(rows.some((r) => r.name.trim()) ? '' : 'Add at least one wallet.');
	const budgetError = $derived(
		!(total && total > 0)
			? 'Enter a budget above 0.'
			: !(days && days >= 1)
				? 'Enter at least 1 day.'
				: splitTotal !== 100
					? `The split adds up to ${splitTotal}%. Make it 100%.`
					: toCentavos(total) > held + 0.5
						? `Your budget wallets only hold ${formatMoney(held)}. Lower the budget to that or less.`
						: ''
	);
	let showErrors = $state(false);

	async function saveWallets(e: SubmitEvent) {
		e.preventDefault();
		showErrors = true;
		if (walletError) return;
		if (!money.chosen) await setCurrency(money.currency); // keep the guessed currency
		for (const r of rows.filter((r) => r.name.trim())) {
			await createWallet(r.name.trim(), '#ffffff', toCentavos(r.amount ?? 0));
		}
		showErrors = false;
		step = 'budget';
	}

	async function saveBudgetStep(e: SubmitEvent) {
		e.preventDefault();
		showErrors = true;
		if (budgetError) return;
		await saveBudget({
			total: toCentavos(total!),
			startDate: todayKey(),
			days: Math.floor(days!),
			split: $state.snapshot(split)
		});
		ondone?.();
	}
</script>

{#if step === 'wallets'}
	<form onsubmit={saveWallets}>
		<h1 class="display">Your wallets</h1>
		<label>
			Currency
			<!-- Starts as a guess from the device's region; picking one saves it. -->
			<select class="field" value={money.currency} onchange={(e) => setCurrency(e.currentTarget.value as Currency)}>
				{#each CURRENCIES as code (code)}
					<option value={code}>{code} · {currencyName(code)}</option>
				{/each}
			</select>
		</label>
		<p class="hint label">How much is in each one right now? ({money.symbol})</p>
		{#each rows as row, i (i)}
			<div class="row wallet-row">
				<input aria-label="Wallet name" placeholder="Savings" bind:value={row.name} />
				<input aria-label="Amount in {row.name || 'wallet'}" type="number" inputmode="decimal" step="0.01" placeholder="0" bind:value={row.amount} />
				<button
					type="button"
					class="remove"
					aria-label="Remove {row.name || 'this wallet'}"
					disabled={rows.length === 1}
					onclick={() => rows.splice(i, 1)}>✕</button
				>
			</div>
		{/each}
		<button type="button" class="btn" onclick={() => rows.push({ name: '', amount: null })}>+ Wallet</button>
		{#if showErrors && walletError}<p class="error">{walletError}</p>{/if}
		<button class="btn btn-primary">Next</button>
	</form>
{:else}
	<form onsubmit={saveBudgetStep}>
		<h1 class="display">Your budget</h1>
		<div class="row">
			<label>Budget<input type="number" inputmode="decimal" step="0.01" placeholder="5000" bind:value={total} /></label>
			<label>Days<input type="number" inputmode="numeric" step="1" min="1" bind:value={days} /></label>
		</div>
		<!-- The limit is visible before you type, so you never hit it by surprise. -->
		<p class="hint label" class:over={!!total && toCentavos(total) > held + 0.5}>Your budget wallets hold {formatMoney(held)}</p>
		<p class="hint label">Split it across your wallets</p>
		{#each wallets as w (w.id)}
			<label class="split">
				<span>{w.name}</span>
				<input type="number" inputmode="numeric" step="1" min="0" max="100" bind:value={split[w.id]} />
				<span class="dim">% · {total && days ? formatMoney(toCentavos((total * (split[w.id] ?? 0)) / 100 / days)) + '/day' : ''}</span>
			</label>
		{/each}
		<!-- Live: problems show as you type, once there's a budget to check. -->
		{#if budgetError && (total || showErrors)}<p class="error">{budgetError}</p>{/if}
		<button class="btn btn-primary" disabled={!!budgetError}>Start</button>
	</form>
{/if}

<style>
	form {
		display: grid;
		gap: 14px;
		width: min(100%, 380px);
	}
	h1 {
		font-size: calc(3.6rem / var(--font-wide));
		margin: 0;
		border-bottom: 2px solid var(--line);
		padding-bottom: 8px;
	}
	.hint {
		margin: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.wallet-row {
		grid-template-columns: 1fr 1fr auto;
		align-items: end;
	}
	.remove {
		background: none;
		border: 0;
		color: var(--dim);
		font-size: calc(1.1rem / var(--font-wide));
		padding: 8px;
		cursor: pointer;
	}
	.remove:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}
	label {
		display: grid;
		gap: 4px;
		font-family: ui-monospace, Consolas, monospace;
		font-style: normal;
		font-weight: 500;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--dim);
	}
	.split {
		grid-template-columns: 1fr 72px auto;
		align-items: center;
		gap: 10px;
		font-family: var(--font);
		font-style: var(--font-style);
		font-weight: var(--font-weight);
		font-size: calc(1.5rem / var(--font-wide));
		letter-spacing: 0;
		color: var(--ink);
	}
	.dim {
		color: var(--dim);
		font-size: calc(1rem / var(--font-wide));
	}
	select {
		font-family: var(--font);
		font-style: var(--font-style);
		font-weight: var(--font-body-weight);
		font-size: calc(1.3rem / var(--font-wide));
		letter-spacing: 0;
		text-transform: none;
		color-scheme: dark;
		cursor: pointer;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		background: transparent;
		border: 0;
		border-bottom: 2px solid var(--line);
		border-radius: 0;
		color: var(--ink);
		font-family: var(--font);
		font-style: var(--font-style);
		font-weight: var(--font-body-weight);
		font-size: calc(1.4rem / var(--font-wide));
		letter-spacing: 0;
		text-transform: none;
		padding: 6px 2px;
	}
	input::placeholder {
		color: var(--dim);
	}
	input:focus {
		outline: none;
		border-bottom-color: var(--accent);
	}
	.error {
		color: var(--danger);
		margin: 0;
	}
	.hint.over {
		color: var(--danger);
	}
</style>