<script lang="ts">
	/**
	 * First-run setup, in the same black style. Step 1 adds wallets (skipped
	 * if some exist), step 2 sets the budget and how it splits across them.
	 */
	import type { Wallet } from './db';
	import { createWallet, saveBudget, toCentavos, todayKey, formatPeso } from './data';

	let { wallets, ondone }: { wallets: Wallet[]; ondone?: () => void } = $props();

	type Row = { name: string; amount: number | null };
	let rows = $state<Row[]>([
		{ name: 'Gcash', amount: null },
		{ name: 'Cash', amount: null }
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
	const walletError = $derived(rows.some((r) => r.name.trim()) ? '' : 'Add at least one wallet.');
	const budgetError = $derived(
		!(total && total > 0)
			? 'Enter a budget above 0.'
			: !(days && days >= 1)
				? 'Enter at least 1 day.'
				: splitTotal !== 100
					? `The split adds up to ${splitTotal}%. Make it 100%.`
					: ''
	);
	let showErrors = $state(false);

	async function saveWallets(e: SubmitEvent) {
		e.preventDefault();
		showErrors = true;
		if (walletError) return;
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
		<h1>Your wallets</h1>
		<p class="hint">How much is in each one right now?</p>
		{#each rows as row, i (i)}
			<div class="row">
				<input aria-label="Wallet name" placeholder="Maribank" bind:value={row.name} />
				<input aria-label="Amount in {row.name || 'wallet'}" type="number" inputmode="decimal" step="0.01" placeholder="0" bind:value={row.amount} />
			</div>
		{/each}
		<button type="button" class="ghost" onclick={() => rows.push({ name: '', amount: null })}>+ Wallet</button>
		{#if showErrors && walletError}<p class="error">{walletError}</p>{/if}
		<button class="go">Next</button>
	</form>
{:else}
	<form onsubmit={saveBudgetStep}>
		<h1>Your budget</h1>
		<div class="row">
			<label>Budget<input type="number" inputmode="decimal" step="0.01" placeholder="5000" bind:value={total} /></label>
			<label>Days<input type="number" inputmode="numeric" step="1" min="1" bind:value={days} /></label>
		</div>
		<p class="hint">Split it across your wallets</p>
		{#each wallets as w (w.id)}
			<label class="split">
				<span>{w.name}</span>
				<input type="number" inputmode="numeric" step="1" min="0" max="100" bind:value={split[w.id]} />
				<span class="dim">% · {total && days ? formatPeso(toCentavos((total * (split[w.id] ?? 0)) / 100 / days)) + '/day' : ''}</span>
			</label>
		{/each}
		{#if showErrors && budgetError}<p class="error">{budgetError}</p>{/if}
		<button class="go">Start</button>
	</form>
{/if}

<style>
	form {
		display: grid;
		gap: 14px;
		width: min(100%, 360px);
	}
	h1 {
		font-size: 3rem;
		font-weight: 800;
		margin: 0;
		line-height: 1;
	}
	.hint {
		color: #6b6b6b;
		margin: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	label {
		display: grid;
		gap: 4px;
		color: #6b6b6b;
		letter-spacing: 0.06em;
	}
	.split {
		grid-template-columns: 1fr 72px auto;
		align-items: center;
		gap: 10px;
		color: #fff;
		letter-spacing: 0;
		font-size: 1.3rem;
	}
	.dim {
		color: #6b6b6b;
		font-size: 1rem;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		background: #141414;
		border: 1px solid #262626;
		border-radius: 10px;
		color: #fff;
		font: inherit;
		font-size: 1.3rem;
		padding: 10px 12px;
	}
	input:focus {
		outline: none;
		border-color: #fff;
	}
	button {
		font: inherit;
		border-radius: 999px;
		padding: 12px;
		cursor: pointer;
		letter-spacing: 0.08em;
	}
	.ghost {
		background: none;
		border: 1px dashed #333;
		color: #8a8a8a;
	}
	.go {
		background: #fff;
		color: #000;
		border: 0;
		font-weight: 700;
		font-size: 1.2rem;
	}
	.error {
		color: #ff8a65;
		margin: 0;
	}
</style>
