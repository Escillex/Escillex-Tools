<script lang="ts">
	import { flushSync, onMount } from 'svelte';
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
	import { trackViewport, viewport } from '#lib/ui/viewport.svelte.ts';
	import Entry from '#lib/finance/Entry.svelte';
	import WalletLoop from '#lib/ui/WalletLoop.svelte';
	import ModeSwitch from '#lib/ui/ModeSwitch.svelte';
	import RollingNumber from '#lib/ui/RollingNumber.svelte';
	import { selection } from '#lib/finance/selection.svelte.ts';
	import { formatWhole } from '#lib/core/currency.svelte.ts';

	const wallets = live(listWallets, []);
	const summary = live(budgetSummary, null);
	const balances = live(walletBalances, {});

	let mode = $state(0); // 0 = allowance, 1 = total balance
	let selected = $state(0);

	/*
	 * The centered wallet is remembered outside this page (selection), so
	 * coming back from Manage/Calendar lands on the same wallet, and the
	 * Wallet layout can color everything in that wallet's colors.
	 */
	let restored = $state(false);
	$effect.pre(() => {
		if (restored || !wallets.loaded) return;
		const i = items.findIndex((it) => it.id === selection.id);
		selected = i >= 0 ? i : 0;
		restored = true;
	});
	$effect(() => {
		const id = items[selected]?.id;
		if (restored && id) selection.id = id;
	});

	/** One box per day of the budget: filled = days that have started. */
	const dayBoxes = $derived.by(() => {
		const s = summary.current;
		if (!s) return [];
		return Array.from({ length: s.budget.days }, (_, i) => ({ filled: i < s.day, today: i === s.day - 1 }));
	});

	// "All" first, then every wallet. The loop wraps around forever.
	const items = $derived([{ id: 'all', label: 'All' }, ...wallets.current.map((w) => ({ id: w.id, label: w.name }))]);

	/** The centered wallet is exempt from the budget, so it has no allowance. */
	const exempt = $derived.by(() => {
		const id = items[selected]?.id;
		const budget = summary.current?.budget;
		return !!id && id !== 'all' && !!budget && !isInBudget(budget, id);
	});
	/** Only in ALLOWANCE is an exempt wallet special (greyed, showing its balance instead). */
	const exemptShown = $derived(mode === 0 && exempt);

	/**
	 * ALLOWANCE: what's left to spend today (an exempt wallet shows its balance).
	 * TOTAL BALANCE: what the wallet holds right now; "All" adds up every wallet.
	 */
	const value = $derived.by(() => {
		const id = items[selected]?.id ?? 'all';
		if (mode === 1) {
			const held = id === 'all' ? wallets.current.reduce((s, w) => s + (balances.current[w.id] ?? 0), 0) : (balances.current[id] ?? 0);
			return held / 100;
		}
		if (exempt) return (balances.current[id] ?? 0) / 100;
		return (summary.current?.byWallet[id]?.allowance ?? 0) / 100;
	});

	const ready = $derived(wallets.loaded && summary.loaded);
	const needsSetup = $derived(ready && (wallets.current.length === 0 || !summary.current));

	/* ---------- setup: fit above the keyboard ---------- */
	onMount(trackViewport);

	/**
	 * The keyboard opens after a field takes focus, so the browser's own
	 * "scroll it into view" runs too early. Once the visible area has
	 * shrunk, bring the focused field (and the buttons under it) back up.
	 */
	let setupEl = $state<HTMLElement>();
	$effect(() => {
		void viewport.height;
		const el = document.activeElement;
		if (setupEl && el instanceof HTMLElement && setupEl.contains(el)) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
	});

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
		if (entry || needsSetup || !ready) return;
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


<div
	class="screen"
	class:fit={needsSetup}
	class:keyboard={needsSetup && viewport.keyboardOpen}
	style:top={needsSetup && viewport.height ? `${viewport.top}px` : null}
	style:height={needsSetup && viewport.height ? `${viewport.height}px` : null}
>
	<a class="back circle" href="/" aria-label="Back to tools">←</a>

	{#if needsSetup}
		<div class="setup" bind:this={setupEl}><Setup wallets={wallets.current} /></div>
	{:else if ready}
		<div class="center">
			<div class="mode">
				<ModeSwitch options={['ALLOWANCE', 'TOTAL BALANCE']} bind:value={mode} />
			</div>
			<div class="wallets display">
				<WalletLoop {items} bind:selected />
			</div>
			<button class="big display" class:exempt={exemptShown} style:--chars={formatWhole(Math.abs(value)).length + (value < 0 ? 1 : 0)} type="button" onclick={() => openEntry()} aria-label="Log an amount">
				<RollingNumber {value} />
			</button>
			<p class="exempt-note label" class:shown={exemptShown}>Not in budget · balance</p>
		</div>

		<div class="bottom">
			{#if summary.current}
				{@const s = summary.current}
				<!-- Tapping the day boxes opens the calendar. -->
				<a class="daysbar" href="/wallet/calendar" onpointerdown={() => (unlockFeedback(), tick())} aria-label="Day {s.day} of {s.budget.days}. Open calendar">
					<div class="days" style:--n={s.budget.days}>
						{#each dayBoxes as d, i (i)}
							<i class:filled={d.filled} class:today={d.today}></i>
						{/each}
					</div>
					<p class="label meta">
						{#if s.day > s.budget.days}
							Budget ended
						{:else if s.day < 1}
							Starts {s.budget.startDate}
						{:else}
							Day {s.day} of {s.budget.days}
						{/if}
						<span class="open">Calendar →</span>
					</p>
				</a>
			{/if}
			<a class="manage" href="/wallet/manage" onpointerdown={() => (unlockFeedback(), tick())}>
				<span class="display">Manage</span>
				<span class="circle" aria-hidden="true">→</span>
			</a>
		</div>
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
	.screen {
		position: relative;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 16px;
		box-sizing: border-box;
		overflow: hidden;
		/* Fades between wallets' colors (the Wallet layout sets them on the page). */
		background: var(--bg);
		color: var(--ink);
		transition:
			background-color 350ms ease,
			color 350ms ease;
	}
	/* Setup has inputs: the screen fits the area above the keyboard and
	   scrolls when the form is taller than that. */
	.screen.fit {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		min-height: 0;
		height: 100dvh;
		justify-content: flex-start;
		overflow-y: auto;
	}
	/* Glide, not jump, when the keyboard opens or closes. */
	@media (prefers-reduced-motion: no-preference) {
		.screen.fit {
			transition:
				height 200ms cubic-bezier(0.2, 0.8, 0.2, 1),
				background-color 350ms ease,
				color 350ms ease;
		}
	}
	/* In a browser tab (not the installed app), Chrome's address bar can sit at the
	   bottom, over the page, while the keyboard is open. Extra room at the end lets
	   the form scroll clear of it. */
	@media (display-mode: browser) {
		.screen.fit.keyboard {
			padding-bottom: 80px;
		}
	}
	/* margin auto centers it when it fits, and lets it scroll from the top when it doesn't. */
	.setup {
		display: flex;
		justify-content: center;
		width: 100%;
		margin-block: auto;
		padding-top: 56px; /* clear of the back button */
	}
	.back {
		position: absolute;
		top: calc(16px + env(safe-area-inset-top, 0px));
		left: 16px;
	}
	/* Switch, wallets and number sit together as one block, centered in the
	   space above the bottom bar (the padding keeps clear of it). */
	.center {
		container-type: inline-size; /* lets the number size itself to this width (cqw) */
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		max-width: 560px;
		padding-bottom: 120px;
	}
	.mode {
		margin-bottom: 28px;
	}
	.wallets {
		width: 100%;
		font-size: calc(1.9rem / var(--font-wide));
	}
	.big {
		color: var(--ink);
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		/*
		 * Auto-fit: big for short numbers, shrinking for long ones so it
		 * always fits. --chars is the number's length (digits + commas);
		 * 0.56em is about one character's width, scaled by the font's width.
		 */
		font-size: min(
			calc(15rem / var(--font-wide)),
			calc(46vw / var(--font-wide)),
			calc(96cqw / (var(--chars) * 0.56 * var(--font-wide)))
		);
		margin-top: 0.02em;
		transition: color 250ms;
	}
	.big.exempt {
		color: var(--dim);
	}
	/* Always takes up space (just invisible) so the number doesn't jump when it appears. */
	.exempt-note {
		margin: 6px 0 0;
		opacity: 0;
		transition: opacity 250ms;
	}
	.exempt-note.shown {
		opacity: 1;
	}
	.bottom {
		position: absolute;
		left: 16px;
		right: 16px;
		bottom: calc(18px + env(safe-area-inset-bottom, 0px));
		max-width: 520px;
		margin: 0 auto;
	}
	/* One box per budget day. Long budgets get thinner boxes, never a second row. */
	.days {
		display: grid;
		grid-template-columns: repeat(var(--n), 1fr);
		gap: 3px;
	}
	.days i {
		height: 14px;
		border: 2px solid var(--line);
		box-sizing: border-box;
	}
	.days i.filled {
		background: var(--ink);
	}
	.days i.today {
		background: var(--accent);
		border-color: var(--accent);
	}
	.daysbar {
		display: block;
		text-decoration: none;
	}
	.meta {
		display: flex;
		justify-content: space-between;
		margin: 6px 0 12px;
	}
	.daysbar:active .days {
		transform: scale(0.99);
	}
	.manage {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 2px solid var(--line);
		padding-top: 10px;
		color: var(--ink);
		text-decoration: none;
		font-size: calc(2rem / var(--font-wide));
	}
	.manage:active .circle {
		background: var(--ink);
		color: var(--bg);
	}
</style>