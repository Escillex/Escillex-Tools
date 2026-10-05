<script lang="ts">
	/**
	 * The budget planner, as its own page (/wallet/manage).
	 * Three tabs: Budget (edit the plan), Wallets (names and balances),
	 * History (everything logged, with delete).
	 */
	import { untrack } from 'svelte';
	import { live } from '#lib/live.svelte.ts';
	import { formatMoney } from '#lib/core/currency.svelte.ts';
	import ColorField from '#lib/ui/ColorField.svelte';
	import { SWATCHES, appPalette } from '#lib/core/theme.svelte.ts';
	import { paletteVars } from '#lib/ui/color.ts';
	import { paletteStyle, walletPalette } from './walletTheme';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import type { Budget, Wallet } from './db';
	import {
		addDays,
		createWallet,
		deleteTransaction,
		deleteWallet,
		listTransactions,
		renameWallet,
		setWalletTheme,
		setWalletBalance,
		toCentavos,
		todayKey
	} from './data';

	let {
		wallets,
		balances,
		budget
	}: {
		wallets: Wallet[];
		balances: Record<string, number>;
		budget: Budget | null;
	} = $props();

	const TABS = ['Wallets', 'History'] as const;
	let tab = $state<(typeof TABS)[number]>('Wallets');

	function pickTab(t: (typeof TABS)[number]) {
		unlockFeedback();
		if (t !== tab) tick();
		tab = t;
	}

	// The budget as it was when the page opened (the History period filter uses it).
	const initial = untrack(() => budget);

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

	let colorsFor = $state<string | null>(null);
	function toggleColors(id: string) {
		unlockFeedback();
		tick();
		colorsFor = colorsFor === id ? null : id;
	}

	let armedWallet = $state<string | null>(null);
	async function onRemoveWallet(id: string) {
		if (armedWallet !== id) {
			armedWallet = id;
			tick();
			return;
		}
		armedWallet = null;
		await deleteWallet(id);
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
				: new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

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

</script>

<div class="page">
	<header>
		<a class="circle" href="/wallet" aria-label="Back to wallet">←</a>
		<h1 class="display">Manage</h1>
	</header>

	<!-- The budget plan lives on its own page now. -->
	<a class="calendar-link" href="/wallet/calendar" onpointerdown={() => (unlockFeedback(), tick())}>
		<span class="display">Budget calendar</span>
		<span class="circle" aria-hidden="true">→</span>
	</a>

	<div class="tabs" role="tablist">
		{#each TABS as t (t)}
			<button type="button" role="tab" class="display" aria-selected={tab === t} class:on={tab === t} onclick={() => pickTab(t)}>{t}</button>
		{/each}
	</div>

	<div class="body">
		{#if tab === 'Wallets'}
			{#each wallets as w (w.id)}
				<div class="wallet">
					<input class="name" aria-label="Wallet name" value={w.name} onchange={(e) => onRename(w, e.currentTarget.value)} />
					<span class="bal">{formatMoney(balances[w.id] ?? 0)}</span>
					<input
						class="set"
						type="number"
						inputmode="decimal"
						step="0.01"
						aria-label="Set {w.name} balance"
						placeholder="Set balance"
						onchange={(e) => onSetBalance(w, e)}
					/>
					<button
						type="button"
						class="del remove-wallet"
						class:armed={armedWallet === w.id}
						disabled={wallets.length === 1}
						title={wallets.length === 1 ? 'You need at least one wallet' : undefined}
						onclick={() => onRemoveWallet(w.id)}
					>
						{armedWallet === w.id ? 'Tap again to remove' : 'Remove'}
					</button>
				</div>
				{#if armedWallet === w.id}
					<p class="dim small">Its history stays. {(budget?.split[w.id] ?? 0) > 0 ? `Its ${budget?.split[w.id]}% budget share goes to your other budget wallets.` : ''}</p>
				{/if}

				<!-- Per-wallet colors -->
				{@const wp = walletPalette(w, appPalette())}
				<button type="button" class="colors-toggle" onclick={() => toggleColors(w.id)} aria-expanded={colorsFor === w.id}>
					<span class="swatch-pair" style:--a={wp.bg} style:--b={wp.accent} aria-hidden="true"></span>
					<span>{colorsFor === w.id ? 'Hide colors' : w.theme ? 'Colors (custom)' : 'Colors'}</span>
				</button>
				{#if colorsFor === w.id}
					{@const app = appPalette()}
					<div class="colors">
						<!-- A live sample of this wallet's screen. -->
						<div class="sample themed" style={paletteStyle(paletteVars(wp))}>
							<span class="display"><span class="tag">{w.name}</span></span>
							<span class="display big">123</span>
						</div>
						<ColorField
							label="Background"
							value={w.theme?.bg ?? 'default'}
							swatches={SWATCHES.bg}
							special={{ value: 'default', label: 'App', shows: app.bg }}
							onchange={(v) => setWalletTheme(w.id, { ...w.theme, bg: v === 'default' ? undefined : v })}
						/>
						<ColorField
							label="Text"
							value={w.theme?.ink ?? 'default'}
							swatches={SWATCHES.ink}
							special={{ value: 'default', label: 'Auto', shows: wp.ink }}
							onchange={(v) => setWalletTheme(w.id, { ...w.theme, ink: v === 'default' ? undefined : v })}
						/>
						<ColorField
							label="Accent"
							value={w.theme?.accent ?? 'default'}
							swatches={SWATCHES.accent}
							special={{ value: 'default', label: 'App', shows: app.accent }}
							onchange={(v) => setWalletTheme(w.id, { ...w.theme, accent: v === 'default' ? undefined : v })}
						/>
						{#if w.theme}
							<button type="button" class="btn" onclick={() => (tick(), setWalletTheme(w.id, {}))}>Use app colors</button>
						{/if}
					</div>
				{/if}
			{/each}
			<form class="add" onsubmit={onAddWallet}>
				<input aria-label="New wallet name" placeholder="New wallet" bind:value={newName} />
				<input aria-label="Starting amount" type="number" inputmode="decimal" step="0.01" placeholder="Has now" bind:value={newAmount} />
				<button class="btn btn-primary">Add</button>
			</form>
			<p class="dim">New wallets start at 0% of the budget. Give them a share in Budget.</p>
		{:else}
			<div class="filters">
				<div class="chips" role="group" aria-label="Wallet">
					<button type="button" class="chip" class:on={fWallet === 'all'} onclick={() => pick((v) => (fWallet = v), fWallet, 'all')}>All wallets</button>
					{#each wallets as w (w.id)}
						<button type="button" class="chip" class:on={fWallet === w.id} onclick={() => pick((v) => (fWallet = v), fWallet, w.id)}>{w.name}</button>
					{/each}
				</div>
				<div class="chips" role="group" aria-label="Type">
					{#each TYPES as [key, label] (key)}
						<button type="button" class="chip" class:on={fType === key} onclick={() => pick((v) => (fType = v), fType, key)}>{label}</button>
					{/each}
				</div>
				{#if initial}
					<div class="chips" role="group" aria-label="Period">
						<button type="button" class="chip" class:on={fPeriod === 'budget'} onclick={() => pick((v) => (fPeriod = v), fPeriod, 'budget')}>This budget</button>
						<button type="button" class="chip" class:on={fPeriod === 'all'} onclick={() => pick((v) => (fPeriod = v), fPeriod, 'all')}>All time</button>
					</div>
				{/if}
				<p class="totals">
					<span>Spent <b class="out">{formatMoney(totals.spent)}</b></span>
					<span>In <b class="in">{formatMoney(totals.moneyIn)}</b></span>
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
						<span class="amt" class:in={t.amount > 0}>{t.amount > 0 ? '+' : '−'}{formatMoney(Math.abs(t.amount))}</span>
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
	.page {
		max-width: 620px;
		margin: 0 auto;
		min-height: 100dvh;
		box-sizing: border-box;
		padding: calc(16px + env(safe-area-inset-top, 0px)) 16px calc(32px + env(safe-area-inset-bottom, 0px));
		display: grid;
		gap: 14px;
		align-content: start;
	}
	header {
		display: flex;
		align-items: center;
		gap: 14px;
		border-bottom: 2px solid var(--line);
		padding-bottom: 12px;
	}
	h1 {
		margin: 0;
		font-size: calc(3.4rem / var(--font-wide));
	}
	h3 {
		margin: 18px 0 2px;
		font-family: ui-monospace, Consolas, monospace;
		font-style: normal;
		font-weight: 500;
		font-size: 0.75rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--dim);
	}
	/* Tabs and chips: plain text; the selected one becomes a slanted accent block. */
	.tabs {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		border-bottom: 2px solid var(--line);
	}
	.tabs button,
	.chip {
		font: inherit;
		background: none;
		border: 0;
		color: var(--dim);
		cursor: pointer;
		text-transform: uppercase;
	}
	.tabs button {
		font-size: calc(1.5rem / var(--font-wide));
		padding: 8px 4px;
	}
	.tabs button.on,
	.chip.on {
		background: var(--accent);
		color: var(--accent-ink);
		clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
	}
	.chip {
		font-size: calc(1rem / var(--font-wide));
		padding: 5px 14px;
		white-space: nowrap;
		border-bottom: 2px solid transparent;
	}
	.calendar-link {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--ink);
		text-decoration: none;
		font-size: calc(1.9rem / var(--font-wide));
		padding: 4px 0 10px;
		border-bottom: 2px solid var(--line);
	}
	.body {
		display: grid;
		gap: 10px;
		align-content: start;
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
		font-size: calc(1.3rem / var(--font-wide));
		letter-spacing: 0;
		text-transform: none;
		padding: 6px 2px;
		color-scheme: dark;
	}
	input::placeholder {
		color: var(--dim);
	}
	input:focus {
		outline: none;
		border-bottom-color: var(--accent);
	}
	.dim {
		color: var(--dim);
		margin: 0;
	}
	.small {
		font-size: calc(0.9rem / var(--font-wide));
	}
	.wallet {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px 12px;
		align-items: center;
		padding: 12px 0;
		border-bottom: 2px solid var(--line);
	}
	.wallet .name {
		font-weight: var(--font-weight);
		font-size: calc(1.6rem / var(--font-wide));
		text-transform: uppercase;
	}
	.wallet .bal {
		font-size: calc(1.5rem / var(--font-wide));
		font-weight: var(--font-weight);
		font-variant-numeric: tabular-nums;
	}
	.wallet .set {
		grid-column: 1;
	}
	.add {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 10px;
		align-items: end;
		margin-top: 8px;
	}
	.filters {
		display: grid;
		gap: 8px;
		padding-bottom: 10px;
		border-bottom: 2px solid var(--line);
	}
	.chips {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.totals {
		display: flex;
		gap: 18px;
		margin: 4px 0 0;
		font-size: calc(1.2rem / var(--font-wide));
		font-variant-numeric: tabular-nums;
	}
	.totals b {
		font-weight: var(--font-weight);
	}
	.out {
		color: var(--ink);
	}
	.in {
		color: var(--accent);
	}
	.tx {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 12px;
		align-items: center;
		padding: 9px 0;
		border-bottom: 1px solid var(--faint);
		font-size: calc(1.2rem / var(--font-wide));
	}
	.amt {
		font-variant-numeric: tabular-nums;
		font-weight: var(--font-weight);
	}
	.amt.in {
		color: var(--accent);
	}
	.del {
		font: inherit;
		font-size: 0.85rem;
		text-transform: uppercase;
		background: none;
		border: 2px solid transparent;
		color: var(--dim);
		padding: 3px 8px;
		cursor: pointer;
	}
	.del.armed {
		color: var(--danger);
		border-color: var(--danger);
	}
	.colors-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		background: none;
		border: 0;
		padding: 8px 0 12px;
		color: var(--dim);
		font: inherit;
		text-transform: uppercase;
		cursor: pointer;
		border-bottom: 2px solid var(--line);
	}
	/* Two slanted halves: the wallet's background and accent. */
	.swatch-pair {
		width: 34px;
		height: 18px;
		background: linear-gradient(110deg, var(--a) 50%, var(--b) 50%);
		box-shadow: inset 0 0 0 2px var(--faint);
	}
	.colors {
		display: grid;
		gap: 14px;
		padding: 12px 0 16px;
		border-bottom: 2px solid var(--line);
	}
	.sample {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 0 8px;
		background: var(--bg);
		color: var(--ink);
		border: 2px solid var(--faint);
	}
	.sample .display {
		font-size: calc(1.6rem / var(--font-wide));
	}
	.sample .big {
		font-size: calc(4rem / var(--font-wide));
	}
	.remove-wallet:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
</style>