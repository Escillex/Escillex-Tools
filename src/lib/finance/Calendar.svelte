<script lang="ts">
	/**
	 * Everything about your money over time:
	 *   1. A month calendar you can flip through (arrows or swipe), with
	 *      budget days marked, spending on every day, and tap-for-details.
	 *   2. Analytics for the month on screen.
	 *   3. The plan: the current budget and each wallet's share, editable.
	 *      The calendar previews the draft live; nothing saves until Save.
	 */
	import { untrack } from 'svelte';
	import { live } from '#lib/live.svelte.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { formatCompact, formatMoney } from '#lib/core/currency.svelte.ts';
	import type { Budget, Wallet } from './db';
	import { addDays, listTransactions, saveBudget, toCentavos, todayKey } from './data';

	let {
		wallets,
		balances,
		budget,
		budgets
	}: { wallets: Wallet[]; balances: Record<string, number>; budget: Budget | null; budgets: Budget[] } = $props();

	const today = todayKey();
	const parse = (k: string) => {
		const [y, m, d] = k.split('-').map(Number);
		return new Date(y, m - 1, d);
	};
	const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	/** Monday = 0 … Sunday = 6. */
	const weekday = (k: string) => (parse(k).getDay() + 6) % 7;
	const prettyDay = (k: string) => parse(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
	const money = (n: number) => formatMoney(Math.round(n));
	const short = (n: number) => formatMoney(Math.round(n)).replace(/[.,]00(?=\D*$)/, '');

	/* ================= the draft plan (current budget) ================= */
	const initial = untrack(() => budget);
	let total = $state(initial ? initial.total / 100 : 0);
	let days = $state(initial?.days ?? 14);
	let start = $state(initial?.startDate ?? today);
	let split = $state<Record<string, number>>({ ...(initial?.split ?? {}) });
	let saved = $state(false);

	const pct = (id: string) => Number(split[id]) || 0;
	const totalC = $derived(toCentavos(Number(total) || 0));
	const nDays = $derived(Math.max(0, Math.floor(Number(days) || 0)));
	const end = $derived(nDays >= 1 && start ? addDays(start, nDays - 1) : start);
	const splitTotal = $derived(wallets.reduce((s, w) => s + pct(w.id), 0));
	const dirty = $derived(
		!initial ||
			totalC !== initial.total ||
			nDays !== initial.days ||
			start !== initial.startDate ||
			wallets.some((w) => pct(w.id) !== (initial.split[w.id] ?? 0))
	);
	const draftDaily = (id: string) => (nDays >= 1 ? (totalC * pct(id)) / 100 / nDays : 0);

	/*
	 * Balance constraint: the budget can't be more than the in-budget
	 * wallets hold together. Spending already done in this period counts as
	 * covered, so the real check is: what's still left of the budget must
	 * fit in their combined balance right now.
	 */
	const inBudgetIds = $derived(wallets.filter((w) => pct(w.id) > 0).map((w) => w.id));
	const heldNow = $derived(inBudgetIds.reduce((s, id) => s + (balances[id] ?? 0), 0));
	const spentSoFar = $derived.by(() => {
		let s = 0;
		for (const [date, d] of Object.entries(byDay)) {
			if (date < start || date > end) continue;
			for (const id of inBudgetIds) s += d.budgetSpent[id] ?? 0;
		}
		return s;
	});
	/** The biggest budget the in-budget wallets can cover. */
	const maxBudget = $derived(Math.max(0, Math.floor(heldNow + spentSoFar)));
	const overBy = $derived(Math.max(0, totalC - maxBudget));
	const error = $derived(
		!(totalC > 0)
			? 'Enter a budget above 0.'
			: nDays < 1
				? 'Enter at least 1 day.'
				: !start
					? 'Pick a start date.'
					: splitTotal !== 100
						? `The split adds up to ${splitTotal}%. Make it 100%.`
						: overBy > 0.5
							? `Your budget wallets can only cover ${money(maxBudget)}. Lower the budget, or put another wallet in it.`
							: ''
	);

	async function save() {
		if (error) return;
		const cleanSplit = Object.fromEntries(wallets.map((w) => [w.id, pct(w.id)]));
		await saveBudget({ id: initial?.id, total: totalC, startDate: start, days: nDays, split: cleanSplit });
		tick(true);
		saved = true;
		setTimeout(() => (saved = false), 1500);
	}

	function toggleExempt(id: string) {
		unlockFeedback();
		if (pct(id) > 0) split[id] = 0;
		else {
			const others = wallets.reduce((s, w) => (w.id === id ? s : s + pct(w.id)), 0);
			split[id] = Math.max(1, 100 - others);
		}
		tick();
	}

	/* ================= which budget covers a day ================= */
	type Plan = { start: string; end: string; total: number; days: number; split: Record<string, number> };
	/** All budget periods, with the current one replaced by the draft (so edits preview live). */
	const plans = $derived.by((): Plan[] => {
		const out = budgets
			.filter((b) => b.id !== initial?.id)
			.map((b) => ({ start: b.startDate, end: addDays(b.startDate, b.days - 1), total: b.total, days: b.days, split: b.split }));
		if (start && nDays >= 1) out.push({ start, end, total: totalC, days: nDays, split: { ...split } });
		return out.sort((a, b) => (a.start < b.start ? -1 : 1));
	});
	/** The latest-starting plan that includes this day, if any. */
	function planFor(date: string): Plan | null {
		let found: Plan | null = null;
		for (const p of plans) if (date >= p.start && date <= p.end) found = p;
		return found;
	}
	/** Allowance per wallet for a day (in-budget wallets only), or null outside any budget. */
	function allowanceFor(date: string): Record<string, number> | null {
		const p = planFor(date);
		if (!p) return null;
		const out: Record<string, number> = {};
		for (const [id, share] of Object.entries(p.split)) if (Number(share) > 0) out[id] = (p.total * Number(share)) / 100 / p.days;
		return out;
	}
	const sum = (r: Record<string, number> | null) => (r ? Object.values(r).reduce((a, b) => a + b, 0) : 0);

	/* ================= every transaction, grouped by day ================= */
	const history = live(() => listTransactions(Infinity), []);
	type DayData = { spent: number; budgetSpent: Record<string, number>; spentBy: Record<string, number>; income: number };
	const byDay = $derived.by(() => {
		const out: Record<string, DayData> = {};
		for (const t of history.current) {
			if (t.kind === 'adjustment') continue;
			const d = (out[t.date] ??= { spent: 0, budgetSpent: {}, spentBy: {}, income: 0 });
			if (t.kind === 'income') d.income += t.amount;
			else {
				d.spent -= t.amount;
				d.spentBy[t.walletId] = (d.spentBy[t.walletId] ?? 0) - t.amount;
				if (t.countsTowardBudget) d.budgetSpent[t.walletId] = (d.budgetSpent[t.walletId] ?? 0) - t.amount;
			}
		}
		return out;
	});
	/** Spending that counts against a day's allowance: in-budget wallets only. */
	function budgetSpentOn(date: string, allowance: Record<string, number>): number {
		const bs = byDay[date]?.budgetSpent ?? {};
		return Object.entries(bs).reduce((s, [id, v]) => s + (id in allowance ? v : 0), 0);
	}

	/* ================= month navigation ================= */
	const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
	const fromMonthKey = (k: number) => new Date(Math.floor(k / 12), k % 12, 1);

	const range = $derived.by(() => {
		let lo = monthKey(parse(today));
		let hi = lo;
		const firstTx = history.current.at(-1)?.date; // list is newest first
		if (firstTx) lo = Math.min(lo, monthKey(parse(firstTx)));
		for (const p of plans) {
			lo = Math.min(lo, monthKey(parse(p.start)));
			hi = Math.max(hi, monthKey(parse(p.end)));
		}
		return { lo, hi };
	});

	let cursor = $state(monthKey(parse(today)));
	const monthStart = $derived(fromMonthKey(cursor));
	const monthTitle = $derived(monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));

	function go(delta: 1 | -1) {
		const next = cursor + delta;
		if (next < range.lo || next > range.hi) return;
		unlockFeedback();
		tick();
		cursor = next;
	}

	// Swipe the grid sideways to change month.
	let swipeX: number | null = null;
	const onSwipeStart = (e: PointerEvent) => (swipeX = e.clientX);
	function onSwipeEnd(e: PointerEvent) {
		if (swipeX === null) return;
		const dx = e.clientX - swipeX;
		swipeX = null;
		if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
	}

	/* ================= the month grid ================= */
	type Cell = { date: string; inMonth: boolean; label: number; allowance: number | null; spent: number; budgetSpent: number };
	const cells = $derived.by((): Cell[] => {
		const first = keyOf(monthStart);
		const lastDay = keyOf(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
		const out: Cell[] = [];
		for (let k = addDays(first, -weekday(first)); k <= addDays(lastDay, 6 - weekday(lastDay)); k = addDays(k, 1)) {
			const a = allowanceFor(k);
			out.push({
				date: k,
				inMonth: k >= first && k <= lastDay,
				label: parse(k).getDate(),
				allowance: a ? sum(a) : null,
				spent: byDay[k]?.spent ?? 0,
				budgetSpent: a ? budgetSpentOn(k, a) : 0
			});
		}
		return out;
	});

	let picked = $state(today);
	function pick(c: Cell) {
		if (!c.inMonth) return;
		unlockFeedback();
		if (c.date !== picked) tick();
		picked = c.date;
	}
	// When you flip to another month, select its first day (or today if it's this month).
	$effect(() => {
		const first = keyOf(monthStart);
		untrack(() => {
			if (picked.slice(0, 7) !== first.slice(0, 7)) picked = first.slice(0, 7) === today.slice(0, 7) ? today : first;
		});
	});

	const pickedAllowance = $derived(allowanceFor(picked));
	const pickedPlan = $derived(planFor(picked));
	const pickedTxs = $derived(history.current.filter((t) => t.date === picked && t.kind !== 'adjustment'));
	const walletName = $derived(Object.fromEntries(wallets.map((w) => [w.id, w.name])));

	/* ================= analytics for the month on screen ================= */
	const stats = $derived.by(() => {
		const monthCells = cells.filter((c) => c.inMonth);
		let spent = 0;
		let income = 0;
		let biggest: { date: string; amount: number } | null = null;
		const byWallet: Record<string, number> = {};
		let budgetDays = 0;
		let onBudget = 0;
		for (const c of monthCells) {
			const d = byDay[c.date];
			if (d) {
				spent += d.spent;
				income += d.income;
				for (const [id, v] of Object.entries(d.spentBy)) byWallet[id] = (byWallet[id] ?? 0) + v;
				if (d.spent > 0 && (!biggest || d.spent > biggest.amount)) biggest = { date: c.date, amount: d.spent };
			}
			if (c.allowance !== null && c.date <= today) {
				budgetDays++;
				if (c.budgetSpent <= c.allowance + 0.5) onBudget++;
			}
		}
		// Days that have happened so far in this month (for the average).
		const elapsed = monthCells.filter((c) => c.date <= today).length;
		const maxDay = Math.max(1, ...monthCells.map((c) => Math.max(c.spent, c.allowance ?? 0)));
		const walletRows = Object.entries(byWallet)
			.map(([id, amount]) => ({ id, name: walletName[id] ?? 'Removed wallet', amount }))
			.sort((a, b) => b.amount - a.amount);
		return { spent, income, net: income - spent, biggest, elapsed, avg: elapsed ? spent / elapsed : 0, budgetDays, onBudget, maxDay, walletRows };
	});
	const maxWallet = $derived(Math.max(1, ...stats.walletRows.map((w) => w.amount)));
</script>

<div class="page">
	<header>
		<a class="circle" href="/wallet" aria-label="Back to wallet">←</a>
		<h1 class="display">Calendar</h1>
	</header>

	<!-- ============ Month switcher + grid ============ -->
	<div class="monthbar">
		<button type="button" class="circle" onclick={() => go(-1)} disabled={cursor <= range.lo} aria-label="Previous month">←</button>
		<h2 class="display">{monthTitle}</h2>
		<button type="button" class="circle" onclick={() => go(1)} disabled={cursor >= range.hi} aria-label="Next month">→</button>
	</div>

	<div class="grid" role="group" aria-label={monthTitle} onpointerdown={onSwipeStart} onpointerup={onSwipeEnd} onpointercancel={() => (swipeX = null)}>
		{#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as d, i (i)}<span class="label dow">{d}</span>{/each}
		{#each cells as c (c.date)}
			{@const budgetDay = c.allowance !== null}
			<button
				type="button"
				class="cell"
				class:out={!c.inMonth}
				class:bday={budgetDay && c.inMonth}
				class:past={budgetDay && c.inMonth && c.date < today}
				class:over={budgetDay && c.inMonth && c.date <= today && c.budgetSpent > c.allowance! + 0.5}
				class:today={c.date === today && c.inMonth}
				class:picked={c.date === picked && c.inMonth}
				disabled={!c.inMonth}
				onclick={() => pick(c)}
				aria-label="{prettyDay(c.date)}, spent {money(c.spent)}"
			>
				<span class="num">{c.label}</span>
				{#if c.inMonth && c.spent > 0}<span class="amt">{formatCompact(c.spent, false)}</span>{/if}
			</button>
		{/each}
	</div>
	<p class="label legend">
		<span><i class="key bday"></i>Budget day</span>
		<span><i class="key past"></i>Passed</span>
		<span><i class="key over"></i>Over</span>
		<span><i class="key today"></i>Today</span>
	</p>

	<!-- ============ The picked day ============ -->
	<section class="dayinfo">
		<h2 class="display">
			{#if pickedPlan}<span class="tag">Day {Math.round((parse(picked).getTime() - parse(pickedPlan.start).getTime()) / 864e5) + 1}</span>{/if}
			{prettyDay(picked)}
		</h2>
		{#if pickedAllowance}
			<div class="rows">
				{#each Object.entries(pickedAllowance) as [id, a] (id)}
					{@const s = byDay[picked]?.budgetSpent[id] ?? 0}
					<div class="row">
						<span class="display">{walletName[id] ?? 'Removed wallet'}</span>
						<span class="figs">
							<span class:over={s > a + 0.5}>{money(a - s)}</span>
							<span class="label">left of {money(a)}</span>
						</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="label">Not part of a budget. Spent {money(byDay[picked]?.spent ?? 0)}{byDay[picked]?.income ? ` · in ${money(byDay[picked].income)}` : ''}.</p>
		{/if}
		{#if pickedTxs.length}
			<div class="txs">
				{#each pickedTxs as t (t.id)}
					<div class="tx">
						<span>{t.note || (t.kind === 'expense' ? 'Spent' : 'Money in')} <span class="label">{walletName[t.walletId] ?? ''}</span></span>
						<span class="display" class:income={t.amount > 0}>{t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="label">Nothing logged this day.</p>
		{/if}
	</section>

	<!-- ============ Analytics for this month ============ -->
	<h2 class="display section">{monthStart.toLocaleDateString(undefined, { month: 'long' })} in numbers</h2>
	<div class="kpis">
		<div><span class="label">Spent</span><span class="display big">{short(stats.spent)}</span></div>
		<div><span class="label">In</span><span class="display big">{short(stats.income)}</span></div>
		<div><span class="label">Net</span><span class="display big" class:neg={stats.net < 0}>{stats.net < 0 ? '−' : ''}{short(Math.abs(stats.net))}</span></div>
	</div>

	<!-- Daily spending: one bar per day, a tick at that day's allowance. -->
	<div class="chart" role="img" aria-label="Spending per day in {monthTitle}">
		{#each cells.filter((c) => c.inMonth) as c (c.date)}
			{@const over = c.allowance !== null && c.budgetSpent > c.allowance + 0.5}
			<div class="col" title="{prettyDay(c.date)}: {money(c.spent)}">
				<div class="bar" class:over class:today={c.date === today} style:height="{(c.spent / stats.maxDay) * 100}%"></div>
				{#if c.allowance !== null}<div class="allow" style:bottom="{(c.allowance / stats.maxDay) * 100}%"></div>{/if}
			</div>
		{/each}
	</div>
	<div class="axis label">
		{#each cells.filter((c) => c.inMonth) as c (c.date)}<span>{c.label === 1 || c.label % 5 === 0 ? c.label : ''}</span>{/each}
	</div>

	<div class="facts">
		<div><span class="label">Avg / day</span><span class="display">{money(stats.avg)}</span></div>
		<div><span class="label">Biggest day</span><span class="display">{stats.biggest ? `${short(stats.biggest.amount)} · ${parse(stats.biggest.date).getDate()}` : '—'}</span></div>
		<div><span class="label">On budget</span><span class="display">{stats.budgetDays ? `${stats.onBudget} of ${stats.budgetDays} days` : '—'}</span></div>
	</div>

	{#if stats.walletRows.length}
		<p class="label">By wallet</p>
		<div class="bywallet">
			{#each stats.walletRows as w (w.id)}
				<div class="wrow">
					<span class="display">{w.name}</span>
					<div class="track"><div class="fill" style:width="{(w.amount / maxWallet) * 100}%"></div></div>
					<span class="display">{short(w.amount)}</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- ============ The plan ============ -->
	<h2 class="display section">Plan</h2>
	<section class="budget">
		<label>Budget<input type="number" inputmode="decimal" step="0.01" bind:value={total} /></label>
		<label>Days<input type="number" inputmode="numeric" step="1" min="1" bind:value={days} /></label>
		<label>Starts<input type="date" bind:value={start} /></label>
	</section>
	<p class="label range">
		{start ? prettyDay(start) : '…'} → {end ? prettyDay(end) : '…'} · {money(wallets.reduce((s, w) => s + draftDaily(w.id), 0))}/day
		· <span class:over-max={overBy > 0.5}>Max {money(maxBudget)}</span>
		· <button type="button" class="link" onclick={() => ((start = today), tick())}>Start today</button>
	</p>

	<div class="wallets">
		{#each wallets as w (w.id)}
			{@const on = pct(w.id) > 0}
			<div class="wallet" class:off={!on}>
				<div class="top">
					<span class="display name">{w.name}</span>
					<span class="display bal">{formatMoney(balances[w.id] ?? 0)}</span>
				</div>
				<div class="bottom">
					{#if on}
						<label class="pct">
							<input type="number" inputmode="numeric" step="1" min="0" max="100" aria-label="{w.name} share" bind:value={split[w.id]} />
							<span>%</span>
						</label>
						<span class="label">{money(draftDaily(w.id))}/day · {money((totalC * pct(w.id)) / 100)} total</span>
					{:else}
						<span class="label">Not in budget</span>
					{/if}
					<button type="button" class="toggle" class:on onclick={() => toggleExempt(w.id)}>{on ? 'In budget' : 'Exempt'}</button>
				</div>
			</div>
		{/each}
	</div>

	{#if dirty || saved}
		<div class="savebar">
			{#if error}<p class="error">{error}</p>{/if}
			<button type="button" class="btn btn-primary" disabled={!!error} onclick={save}>{saved ? 'Saved' : 'Save plan'}</button>
		</div>
	{/if}
</div>

<style>
	.page {
		max-width: 620px;
		margin: 0 auto;
		min-height: 100dvh;
		box-sizing: border-box;
		padding: calc(16px + env(safe-area-inset-top, 0px)) 16px calc(110px + env(safe-area-inset-bottom, 0px));
		display: grid;
		gap: 12px;
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
	.circle:disabled {
		opacity: 0.25;
		cursor: default;
	}

	/* ---------- month switcher + grid ---------- */
	.monthbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.monthbar h2 {
		margin: 0;
		font-size: calc(2.1rem / var(--font-wide));
		text-align: center;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		touch-action: pan-y;
	}
	.dow {
		text-align: center;
	}
	.cell {
		container-type: inline-size;
		aspect-ratio: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 4px 5px;
		background: none;
		border: 2px solid var(--faint);
		color: var(--ink);
		font-family: var(--font);
		font-style: var(--font-style);
		font-weight: var(--font-weight);
		cursor: pointer;
		text-align: left;
	}
	.cell.out {
		border-color: transparent;
		color: var(--faint);
		cursor: default;
	}
	.cell.bday {
		border-color: var(--line);
	}
	.cell.past {
		background: var(--ink);
		color: var(--bg);
	}
	.cell.over {
		background: var(--danger);
		border-color: var(--danger);
		color: #fff;
	}
	.cell.today {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.cell.picked {
		outline: 3px solid var(--accent);
		outline-offset: 3px;
	}
	.num {
		font-size: calc(1.25rem / var(--font-wide));
		line-height: 1;
	}
	.amt {
		width: 100%;
		/* Sized from the box's own width (cqw), so it fits even on tiny phones and wide fonts. */
		font-size: calc(min(0.78rem, 30cqw) / var(--font-wide));
		line-height: 1;
		overflow: hidden;
		white-space: nowrap;
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin: 0;
	}
	.legend span {
		display: inline-flex;
		align-items: center;
		gap: 5px;
	}
	.key {
		display: inline-block;
		width: 10px;
		height: 10px;
		border: 2px solid var(--line);
	}
	.key.past {
		background: var(--ink);
	}
	.key.over {
		background: var(--danger);
		border-color: var(--danger);
	}
	.key.today {
		background: var(--accent);
		border-color: var(--accent);
	}

	/* ---------- picked day ---------- */
	.dayinfo {
		display: grid;
		gap: 8px;
		padding-top: 12px;
		border-top: 2px solid var(--line);
	}
	.dayinfo h2 {
		margin: 0;
		font-size: calc(1.9rem / var(--font-wide));
	}
	.rows,
	.txs {
		display: grid;
	}
	.row,
	.tx {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 10px;
		padding: 7px 0;
		border-bottom: 1px solid var(--faint);
	}
	.row .display {
		font-size: calc(1.5rem / var(--font-wide));
	}
	.figs {
		display: grid;
		justify-items: end;
		font-size: calc(1.4rem / var(--font-wide));
		font-weight: var(--font-weight);
	}
	.figs .over {
		color: var(--danger);
	}
	.tx {
		font-size: calc(1.15rem / var(--font-wide));
	}
	.tx .income {
		color: var(--accent);
	}

	/* ---------- analytics ---------- */
	.section {
		margin: 22px 0 0;
		font-size: calc(2.2rem / var(--font-wide));
		border-bottom: 2px solid var(--line);
		padding-bottom: 6px;
	}
	.kpis {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.kpis div,
	.facts div {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.big {
		font-size: calc(2.1rem / var(--font-wide));
		font-variant-numeric: tabular-nums;
		overflow-wrap: anywhere;
	}
	.neg {
		color: var(--danger);
	}
	.chart {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 130px;
		border-bottom: 2px solid var(--line);
	}
	.col {
		position: relative;
		flex: 1;
		height: 100%;
		display: flex;
		align-items: flex-end;
	}
	.bar {
		width: 100%;
		background: var(--ink);
		min-height: 0;
	}
	.bar.over {
		background: var(--danger);
	}
	.bar.today {
		background: var(--accent);
	}
	/* The day's allowance: a short line across the column. */
	.allow {
		position: absolute;
		left: -1px;
		right: -1px;
		height: 0;
		border-top: 2px dashed var(--dim);
	}
	.axis {
		display: flex;
		gap: 2px;
		margin-top: -6px;
	}
	.axis span {
		flex: 1;
		text-align: center;
	}
	.facts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
	.facts .display {
		font-size: calc(1.3rem / var(--font-wide));
	}
	.bywallet {
		display: grid;
		gap: 6px;
	}
	.wrow {
		display: grid;
		grid-template-columns: minmax(70px, auto) 1fr auto;
		gap: 10px;
		align-items: center;
		font-size: calc(1.3rem / var(--font-wide));
	}
	.track {
		height: 14px;
		border: 2px solid var(--line);
	}
	.fill {
		height: 100%;
		background: var(--ink);
	}

	/* ---------- plan ---------- */
	label {
		display: grid;
		gap: 4px;
		min-width: 0;
		font-family: ui-monospace, Consolas, monospace;
		font-style: normal;
		font-weight: 500;
		font-size: 0.72rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--dim);
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
		font-weight: var(--font-weight);
		font-size: calc(1.5rem / var(--font-wide));
		letter-spacing: 0;
		text-transform: none;
		padding: 4px 2px;
		color-scheme: dark;
	}
	input:focus {
		outline: none;
		border-bottom-color: var(--accent);
	}
	.budget {
		display: grid;
		grid-template-columns: 1.1fr 0.6fr 1.3fr;
		gap: 12px;
	}
	.range {
		margin: 0;
	}
	.link {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		color: var(--ink);
		text-decoration: underline;
		cursor: pointer;
	}
	.wallets {
		display: grid;
	}
	.wallet {
		display: grid;
		gap: 4px;
		padding: 10px 0;
		border-bottom: 1px solid var(--faint);
	}
	.wallet .top,
	.wallet .bottom {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.wallet .name,
	.wallet .bal {
		font-size: calc(1.7rem / var(--font-wide));
	}
	.wallet.off .name,
	.wallet.off .bal {
		color: var(--dim);
	}
	.pct {
		display: flex;
		align-items: baseline;
		gap: 2px;
		width: 70px;
		font-family: var(--font);
		font-size: calc(1.2rem / var(--font-wide));
		color: var(--ink);
	}
	.pct input {
		font-size: calc(1.4rem / var(--font-wide));
	}
	.bottom .label {
		flex: 1;
	}
	.over-max {
		color: var(--danger);
	}
	.toggle {
		font-family: var(--font);
		font-style: var(--font-style);
		font-weight: var(--font-weight);
		text-transform: uppercase;
		font-size: calc(0.95rem / var(--font-wide));
		background: none;
		border: 2px solid var(--faint);
		color: var(--dim);
		padding: 4px 10px;
		cursor: pointer;
		white-space: nowrap;
	}
	.toggle.on {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
		clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
	}
	.savebar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: grid;
		gap: 6px;
		padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px));
		background: var(--bg);
		border-top: 2px solid var(--line);
	}
	.savebar .btn {
		width: min(100%, 588px);
		justify-self: center;
		font-size: calc(1.4rem / var(--font-wide));
	}
	.error {
		margin: 0;
		text-align: center;
		color: var(--danger);
	}
	@media (max-width: 420px) {
		.budget {
			grid-template-columns: 1fr 1fr;
		}
		.budget label:last-child {
			grid-column: 1 / -1;
		}
		.big {
			font-size: calc(1.7rem / var(--font-wide));
		}
	}
</style>
