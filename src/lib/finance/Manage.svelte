<script lang="ts">
	/**
	 * The budget planner: a glass sheet that slides up over the main screen.
	 * Three tabs: Budget (edit the plan), Wallets (names and balances),
	 * History (everything logged, with delete).
	 */
	import { untrack } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { live } from '#lib/live.svelte.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import type { Budget, Wallet } from './db';
	import {
		addDays,
		createWallet,
		deleteTransaction,
		formatPeso,
		listTransactions,
		renameWallet,
		saveBudget,
		setWalletBalance,
		toCentavos,
		todayKey
	} from './data';

	let {
		wallets,
		balances,
		budget,
		onclose
	}: {
		wallets: Wallet[];
		balances: Record<string, number>;
		budget: Budget | null;
		onclose: () => void;
	} = $props();

	const TABS = ['Budget', 'Wallets', 'History'] as const;
	let tab = $state<(typeof TABS)[number]>('Budget');

	function pickTab(t: (typeof TABS)[number]) {
		unlockFeedback();
		if (t !== tab) tick();
		tab = t;
	}

	/* ---------- Budget tab ---------- */
	// A working copy: edits only take effect when you press Save. untrack
	// says "read the budget once, on open", on purpose, so live updates
	// don't overwrite what you're typing.
	const initial = untrack(() => budget);
	let total = $state(initial ? initial.total / 100 : 0);
	let days = $state(initial?.days ?? 14);
	let start = $state(initial?.startDate ?? todayKey());
	let split = $state<Record<string, number>>({ ...(initial?.split ?? {}) });
	let saved = $state(false);

	const splitTotal = $derived(wallets.reduce((s, w) => s + (Number(split[w.id]) || 0), 0));
	const budgetError = $derived(
		!(total > 0)
			? 'Enter a budget above 0.'
			: !(days >= 1)
				? 'Enter at least 1 day.'
				: splitTotal !== 100
					? `The split adds up to ${splitTotal}%. Make it 100%.`
					: ''
	);

	async function onSaveBudget() {
		if (budgetError) return;
		const cleanSplit = Object.fromEntries(wallets.map((w) => [w.id, Number(split[w.id]) || 0]));
		await saveBudget({ id: budget?.id, total: toCentavos(total), startDate: start, days: Math.floor(days), split: cleanSplit });
		tick(true);
		saved = true;
		setTimeout(() => (saved = false), 1500);
	}

	/**
	 * Exempt = 0%. Bringing a wallet back gives it whatever share is left
	 * (100 − the others), so the split usually stays valid.
	 */
	function toggleExempt(id: string) {
		if ((Number(split[id]) || 0) > 0) {
			split[id] = 0;
		} else {
			const others = wallets.reduce((s, w) => (w.id === id ? s : s + (Number(split[w.id]) || 0)), 0);
			split[id] = Math.max(1, 100 - others);
		}
		tick();
	}

	function startNewPeriod() {
		start = todayKey();
		tick();
	}

	/* ---------- Wallets tab ---------- */
	let newName = $state('');
	let newAmount = $state<number | null>(null);

	async function onRename(w: Wallet, name: string) {
		if (name.trim()) await renameWallet(w.id, name.trim());
	}

	async function onSetBalance(w: Wallet, e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		if (el.value === '') return;
		await setWalletBalance(w.id, toCentavos(Number(el.value)));
		el.value = '';
		tick(true);
	}

	async function onAddWallet(e: SubmitEvent) {
		e.preventDefault();
		if (!newName.trim()) return;
		await createWallet(newName.trim(), '#ffffff', toCentavos(newAmount ?? 0));
		newName = '';
		newAmount = null;
		tick(true);
	}

	/* ---------- History tab ---------- */
	const history = live(() => listTransactions(), []);
	const walletName = $derived(Object.fromEntries(wallets.map((w) => [w.id, w.name])));

	// Filters. They only change what's shown, never the data.
	const TYPES = [
		['all', 'All'],
		['expense', 'Spent'],
		['income', 'Money in'],
		['adjustment', 'Balance changes']
	] as const;
	let fWallet = $state<string>('all');
	let fType = $state<(typeof TYPES)[number][0]>('all');
	let fPeriod = $state<'budget' | 'all'>(initial ? 'budget' : 'all');

	function pick<T extends string>(set: (v: T) => void, current: T, next: T) {
		if (current !== next) tick();
		set(next);
	}

	const filtered = $derived.by(() => {
		const from = initial?.startDate ?? '';
		const to = initial ? addDays(initial.startDate, initial.days - 1) : '';
		return history.current.filter(
			(t) =>
				(fWallet === 'all' || t.walletId === fWallet) &&
				(fType === 'all' || t.kind === fType) &&
				(fPeriod === 'all' || (t.date >= from && t.date <= to))
		);
	});

	const totals = $derived.by(() => {
		let spent = 0;
		let moneyIn = 0;
		for (const t of filtered) {
			if (t.kind === 'expense') spent -= t.amount;
			if (t.kind === 'income') moneyIn += t.amount;
		}
		return { spent, moneyIn };
	});

	const groups = $derived.by(() => {
		const out: { date: string; items: typeof history.current }[] = [];
		for (const t of filtered) {
			const last = out.at(-1);
			if (last?.date === t.date) last.items.push(t);
			else out.push({ date: t.date, items: [t] });
		}
		return out;
	});
	const dayLabel = (d: string) =>
		d === todayKey()
			? 'Today'
			: d === addDays(todayKey(), -1)
				? 'Yesterday'
				: new Date(d + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

	let armed = $state<string | null>(null);
	async function onDelete(id: string) {
		if (armed !== id) {
			armed = id;
			tick();
			return;
		}
		armed = null;
		await deleteTransaction(id);
		tick(true);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="backdrop" transition:fade={{ duration: 200 }} onclick={onclose} aria-hidden="true"></div>

<div class="sheet glass" role="dialog" aria-modal="true" aria-label="Manage" transition:fly={{ y: 600, duration: 380, easing: cubicOut }}>
	<header>
		<h2>Manage</h2>
		<button class="close" type="button" onclick={onclose} aria-label="Close">✕</button>
	</header>

	<div class="tabs" role="tablist">
		{#each TABS as t (t)}
			<button type="button" role="tab" aria-selected={tab === t} class:glass-raised={tab === t} onclick={() => pickTab(t)}>{t}</button>
		{/each}
	</div>

	<div class="body">
		{#if tab === 'Budget'}
			<div class="grid3">
				<label>Budget<input type="number" inputmode="decimal" step="0.01" bind:value={total} /></label>
				<label>Days<input type="number" inputmode="numeric" step="1" min="1" bind:value={days} /></label>
				<label>Starts<input type="date" bind:value={start} /></label>
			</div>
			<p class="dim">
				{start} to {days >= 1 ? addDays(start, Math.floor(days) - 1) : '…'}
				· <button type="button" class="link" onclick={startNewPeriod}>Start today</button>
			</p>

			<h3>Split</h3>
			{#each wallets as w (w.id)}
				{@const inBudget = (Number(split[w.id]) || 0) > 0}
				<div class="split" class:off={!inBudget}>
					<span>{w.name}</span>
					{#if inBudget}
						<input type="number" inputmode="numeric" step="1" min="0" max="100" aria-label="{w.name} share in percent" bind:value={split[w.id]} />
						<span class="dim">
							% · {total > 0 && days >= 1 ? formatPeso(toCentavos((total * (Number(split[w.id]) || 0)) / 100 / days)) : '₱0.00'}/day
						</span>
					{:else}
						<span class="dim exempt-label">Exempt</span>
					{/if}
					<button type="button" class="chip" class:glass-raised={inBudget} onclick={() => toggleExempt(w.id)}>
						{inBudget ? 'In budget' : 'Exempt'}
					</button>
				</div>
			{/each}

			{#if budgetError}<p class="error">{budgetError}</p>{/if}
			<button class="primary" type="button" onclick={onSaveBudget} disabled={!!budgetError}>{saved ? 'Saved' : 'Save budget'}</button>
		{:else if tab === 'Wallets'}
			{#each wallets as w (w.id)}
				<div class="wallet">
					<input class="name" aria-label="Wallet name" value={w.name} onchange={(e) => onRename(w, e.currentTarget.value)} />
					<span class="bal">{formatPeso(balances[w.id] ?? 0)}</span>
					<input
						class="set"
						type="number"
						inputmode="decimal"
						step="0.01"
						aria-label="Set {w.name} balance"
						placeholder="Set balance"
						onchange={(e) => onSetBalance(w, e)}
					/>
				</div>
			{/each}
			<form class="add" onsubmit={onAddWallet}>
				<input aria-label="New wallet name" placeholder="New wallet" bind:value={newName} />
				<input aria-label="Starting amount" type="number" inputmode="decimal" step="0.01" placeholder="Has now" bind:value={newAmount} />
				<button class="primary">Add</button>
			</form>
			<p class="dim">New wallets start at 0% of the budget. Give them a share in Budget.</p>
		{:else}
			<div class="filters">
				<div class="chips" role="group" aria-label="Wallet">
					<button type="button" class="chip" class:glass-raised={fWallet === 'all'} onclick={() => pick((v) => (fWallet = v), fWallet, 'all')}>All wallets</button>
					{#each wallets as w (w.id)}
						<button type="button" class="chip" class:glass-raised={fWallet === w.id} onclick={() => pick((v) => (fWallet = v), fWallet, w.id)}>{w.name}</button>
					{/each}
				</div>
				<div class="chips" role="group" aria-label="Type">
					{#each TYPES as [key, label] (key)}
						<button type="button" class="chip" class:glass-raised={fType === key} onclick={() => pick((v) => (fType = v), fType, key)}>{label}</button>
					{/each}
				</div>
				{#if initial}
					<div class="chips" role="group" aria-label="Period">
						<button type="button" class="chip" class:glass-raised={fPeriod === 'budget'} onclick={() => pick((v) => (fPeriod = v), fPeriod, 'budget')}>This budget</button>
						<button type="button" class="chip" class:glass-raised={fPeriod === 'all'} onclick={() => pick((v) => (fPeriod = v), fPeriod, 'all')}>All time</button>
					</div>
				{/if}
				<p class="totals">
					<span>Spent <b class="out">{formatPeso(totals.spent)}</b></span>
					<span>In <b class="in">{formatPeso(totals.moneyIn)}</b></span>
				</p>
			</div>

			{#if groups.length === 0}
				<p class="dim">
					{history.current.length === 0
						? 'Nothing logged yet. Type an amount on the main screen to log your first one.'
						: 'Nothing matches these filters.'}
				</p>
			{/if}
			{#each groups as g (g.date)}
				<h3>{dayLabel(g.date)}</h3>
				{#each g.items as t (t.id)}
					<div class="tx">
						<div>
							<div>{t.note || (t.kind === 'expense' ? 'Spent' : t.kind === 'income' ? 'Money in' : 'Balance change')}</div>
							<div class="dim small">{walletName[t.walletId] ?? 'Removed wallet'}{t.kind === 'expense' && !t.countsTowardBudget ? ' · outside budget' : ''}</div>
						</div>
						<span class="amt" class:in={t.amount > 0}>{t.amount > 0 ? '+' : '−'}{formatPeso(Math.abs(t.amount))}</span>
						<button type="button" class="del" class:armed={armed === t.id} onclick={() => onDelete(t.id)}>
							{armed === t.id ? 'Sure?' : 'Delete'}
						</button>
					</div>
				{/each}
			{/each}
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgb(0 0 0 / 0.55);
	}
	.sheet {
		position: fixed;
		z-index: 21;
		left: 50%;
		bottom: 0;
		translate: -50% 0;
		width: min(100%, 560px);
		max-height: 88dvh;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		border-radius: 28px 28px 0 0;
		border-bottom: 0;
		padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 2.4rem;
		font-weight: 800;
		line-height: 1;
	}
	h3 {
		margin: 14px 0 4px;
		font-size: 0.95rem;
		letter-spacing: 0.08em;
		color: rgb(255 255 255 / 0.5);
		font-weight: 600;
	}
	.close {
		background: none;
		border: 0;
		color: rgb(255 255 255 / 0.6);
		font-size: 1.3rem;
		cursor: pointer;
		padding: 6px;
	}
	.tabs {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
		margin: 14px 0 6px;
	}
	.tabs button {
		font: inherit;
		color: #fff;
		background: none;
		border: 1px solid transparent;
		border-radius: 999px;
		padding: 8px;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.tabs button:not(.glass-raised) {
		color: rgb(255 255 255 / 0.5);
	}
	.body {
		overflow-y: auto;
		padding: 6px 2px 4px;
		display: grid;
		gap: 10px;
		align-content: start;
	}
	label {
		display: grid;
		gap: 4px;
		color: rgb(255 255 255 / 0.5);
		letter-spacing: 0.06em;
		min-width: 0;
	}
	input {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		background: rgb(255 255 255 / 0.06);
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 12px;
		color: #fff;
		font: inherit;
		font-size: 1.15rem;
		padding: 9px 11px;
		color-scheme: dark;
	}
	input:focus {
		outline: none;
		border-color: rgb(255 255 255 / 0.6);
	}
	.grid3 {
		display: grid;
		grid-template-columns: 1fr 0.6fr 1.2fr;
		gap: 8px;
	}
	.split {
		display: grid;
		grid-template-columns: 1fr 64px auto auto;
		gap: 8px;
		align-items: center;
		color: #fff;
		font-size: 1.15rem;
	}
	.split.off > span:first-child {
		color: rgb(255 255 255 / 0.4);
	}
	.exempt-label {
		grid-column: 2 / 4;
	}
	.chip {
		font: inherit;
		font-size: 0.85rem;
		letter-spacing: 0.06em;
		color: #fff;
		background: none;
		border: 1px solid rgb(255 255 255 / 0.15);
		border-radius: 999px;
		padding: 5px 12px;
		cursor: pointer;
		white-space: nowrap;
	}
	.chip:not(.glass-raised) {
		color: rgb(255 255 255 / 0.5);
	}
	.dim {
		color: rgb(255 255 255 / 0.45);
		margin: 0;
	}
	.small {
		font-size: 0.85rem;
	}
	.link {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: #fff;
		text-decoration: underline;
		cursor: pointer;
	}
	.error {
		color: #ff8a65;
		margin: 0;
	}
	.primary {
		font: inherit;
		font-weight: 700;
		font-size: 1.1rem;
		letter-spacing: 0.08em;
		background: #fff;
		color: #000;
		border: 0;
		border-radius: 999px;
		padding: 11px 20px;
		cursor: pointer;
	}
	.primary:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.wallet {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px 10px;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}
	.wallet .name {
		font-weight: 700;
	}
	.wallet .bal {
		font-size: 1.3rem;
		font-variant-numeric: tabular-nums;
	}
	.wallet .set {
		grid-column: 1 / -1;
	}
	.add {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 8px;
		margin-top: 6px;
	}
	.filters {
		display: grid;
		gap: 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}
	/* One scrollable row per filter, so long wallet lists don't wrap into a mess. */
	.chips {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.totals {
		display: flex;
		gap: 16px;
		margin: 2px 0 0;
		color: rgb(255 255 255 / 0.5);
		font-variant-numeric: tabular-nums;
	}
	.totals b {
		font-weight: 600;
	}
	.out {
		color: #ff8a65;
	}
	.in {
		color: #4ade80;
	}
	.tx {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 10px;
		align-items: center;
		padding: 8px 0;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
		font-size: 1.1rem;
	}
	.amt {
		font-variant-numeric: tabular-nums;
		color: #ff8a65;
	}
	.amt.in {
		color: #4ade80;
	}
	.del {
		font: inherit;
		font-size: 0.85rem;
		background: none;
		border: 1px solid transparent;
		color: rgb(255 255 255 / 0.4);
		border-radius: 8px;
		padding: 4px 8px;
		cursor: pointer;
	}
	.del.armed {
		color: #ff8a65;
		border-color: #ff8a65;
	}
	@media (max-width: 420px) {
		.grid3 {
			grid-template-columns: 1fr 1fr;
		}
		.grid3 label:last-child {
			grid-column: 1 / -1;
		}
	}
</style>
