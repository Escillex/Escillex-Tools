<script lang="ts">
	/**
	 * Full-screen amount entry. One real <input> sits under the giant
	 * number and holds focus, so the same code handles a PC keyboard and
	 * a phone's number pad. Any "+" or "-" typed (before or after the
	 * number) flips the sign instead of becoming part of the number.
	 */
	import { onMount } from 'svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import RollingNumber from '#lib/ui/RollingNumber.svelte';
	import WalletLoop from '#lib/ui/WalletLoop.svelte';
	import { formatPeso } from './data';

	let {
		initial = '',
		items,
		selected = $bindable(0),
		walletName,
		balance,
		onsubmit,
		oncancel
	}: {
		initial?: string;
		items: { id: string; label: string }[];
		selected?: number;
		walletName: string | null; // null = "All" is selected, can't log
		balance: number; // centavos, shown greyed out
		onsubmit: (amount: number, sign: 1 | -1) => void;
		oncancel: () => void;
	} = $props();

	let input: HTMLInputElement;
	let sign = $state<1 | -1>(-1);
	let digits = $state('');
	let error = $state('');

	// Switching wallets clears a "swipe to a wallet first" message.
	$effect(() => {
		void selected;
		error = '';
	});

	/** Take whatever is in the input, pull the signs out, keep a clean number. */
	function absorb(raw: string, typed?: string | null) {
		if (typed === '+' || typed === '-') sign = typed === '+' ? 1 : -1;
		else if (raw.includes('+')) sign = 1;
		else if (raw.includes('-')) sign = -1;

		let clean = raw.replace(/[^0-9.]/g, '');
		const dot = clean.indexOf('.');
		if (dot !== -1) clean = clean.slice(0, dot + 1) + clean.slice(dot + 1).replace(/\./g, '').slice(0, 2);
		if (clean.length > 9) clean = clean.slice(0, 9);

		if (clean !== digits) tick();
		digits = clean;
		input.value = clean;
		error = '';
	}

	function flip() {
		unlockFeedback();
		sign = sign === 1 ? -1 : 1;
		tick();
		input.focus();
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const amount = Number(digits);
		if (!walletName) {
			error = 'Swipe to a wallet first';
			return;
		}
		if (!(amount > 0)) {
			error = 'Type an amount';
			return;
		}
		onsubmit(amount, sign);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}

	// onMount, not $effect: this must run once, not again every time `digits` changes.
	onMount(() => {
		input.focus();
		absorb(initial, initial);
	});

	// The whole-peso part rolls; centavos (if typed) sit after it as plain text.
	const dot = $derived(digits.indexOf('.'));
	const whole = $derived(Number(dot === -1 ? digits : digits.slice(0, dot)) || 0);
	const fraction = $derived(dot === -1 ? '' : digits.slice(dot));

	/* ---------- drag / scroll to adjust ---------- */
	const NOTCH = 18; // px of drag per notch
	const WHEEL_NOTCH = 40; // wheel delta per notch

	/** Faster movement = bigger steps. Speed is in px per ms. */
	const stepFor = (speed: number) => (speed < 0.5 ? 1 : speed < 1.4 ? 10 : 100);

	/**
	 * Detents: numbers ending in 0 or 5 are "magnetic". Leaving one takes
	 * STICKY times more drag than a normal step, so slowing down tends to
	 * land on them, but 21, 22, 23… are still reachable.
	 */
	const STICKY = 2.5;
	const isDetent = (n: number) => n % 5 === 0;
	const notchSize = (base: number) => (isDetent(whole) ? base * STICKY : base);

	/**
	 * Move to the next multiple of `step` in that direction. Step 1 is a
	 * plain ±1; bigger steps land on round numbers: 23 → 30 (+10) or 100 (+100).
	 */
	const snap = (value: number, direction: 1 | -1, step: number) =>
		direction === 1 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step;

	let adjusting = $state(false);
	let badge = $state<string | null>(null);
	let badgeTimer: ReturnType<typeof setTimeout>;

	function nudge(direction: 1 | -1, step: number) {
		const next = Math.max(0, snap(whole, direction, step));
		badge = (direction === 1 ? '+' : '−') + step;
		clearTimeout(badgeTimer);
		badgeTimer = setTimeout(() => (badge = null), 700);
		if (next === whole || String(next).length > 9) return;
		digits = String(next) + fraction;
		input.value = digits;
		error = '';
		tick(isDetent(next)); // heavier click when landing on a 0 or 5
	}

	let drag: { y: number; t: number; acc: number } | null = null;

	function onPointerDown(e: PointerEvent) {
		e.preventDefault(); // keep focus on the hidden input
		unlockFeedback();
		drag = { y: e.clientY, t: e.timeStamp, acc: 0 };
		adjusting = true;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!drag) return;
		const dy = drag.y - e.clientY; // up = positive
		const speed = Math.abs(dy) / Math.max(1, e.timeStamp - drag.t);
		drag.y = e.clientY;
		drag.t = e.timeStamp;
		drag.acc += dy;
		// Only slow (±1) movement feels the detents; fast flicks fly past them.
		let need = stepFor(speed) === 1 ? notchSize(NOTCH) : NOTCH;
		while (Math.abs(drag.acc) >= need) {
			const direction = drag.acc > 0 ? 1 : -1;
			drag.acc -= direction * need;
			nudge(direction, stepFor(speed));
			need = stepFor(speed) === 1 ? notchSize(NOTCH) : NOTCH;
		}
	}

	function onPointerUp() {
		drag = null;
		adjusting = false;
	}

	let wheelAcc = 0;
	let lastWheel = 0;
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		unlockFeedback();
		const speed = Math.abs(e.deltaY) / Math.max(1, e.timeStamp - lastWheel);
		lastWheel = e.timeStamp;
		wheelAcc -= e.deltaY; // wheel up = bigger
		let need = stepFor(speed) === 1 ? notchSize(WHEEL_NOTCH) : WHEEL_NOTCH;
		while (Math.abs(wheelAcc) >= need) {
			const direction = wheelAcc > 0 ? 1 : -1;
			wheelAcc -= direction * need;
			nudge(direction, stepFor(speed));
			need = stepFor(speed) === 1 ? notchSize(WHEEL_NOTCH) : WHEEL_NOTCH;
		}
	}

	let amountEl: HTMLSpanElement;
	$effect(() => {
		// Wheel listeners must be non-passive for preventDefault to stop page scroll.
		amountEl.addEventListener('wheel', onWheel, { passive: false });
		return () => amountEl.removeEventListener('wheel', onWheel);
	});

	/** Buttons around the number shouldn't steal focus from the hidden input (keeps the phone keyboard up). */
	const keepFocus = (e: PointerEvent) => e.preventDefault();
</script>

<form class="entry" onsubmit={submit}>
	<input
		bind:this={input}
		class="sink"
		aria-label="Amount"
		inputmode="decimal"
		enterkeyhint="done"
		autocomplete="off"
		oninput={(e) => absorb(e.currentTarget.value, (e as unknown as InputEvent).data)}
		onkeydown={onKeyDown}
		onblur={() => setTimeout(() => input?.focus(), 0)}
	/>

	<div class="to">
		<WalletLoop {items} bind:selected />
	</div>
	<p class="balance">Balance {formatPeso(balance)}</p>

	<div class="line">
		<button type="button" class="sign" class:plus={sign === 1} onpointerdown={keepFocus} onclick={flip} aria-label={sign === 1 ? 'Money in. Switch to spending' : 'Spending. Switch to money in'}>
			{sign === 1 ? '+' : '−'}
		</button>
		<span
			class="amount"
			aria-hidden="true"
			bind:this={amountEl}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			<RollingNumber value={whole} fast={adjusting || badge !== null} />{fraction}
			{#if badge}<span class="badge" class:up={badge.startsWith('+')}>{badge}</span>{/if}
		</span>
		<button class="enter" onpointerdown={keepFocus} aria-label="Log it">↵</button>
	</div>

	<p class="hint">
		{#if error}<span class="error">{error}</span>{:else}{sign === 1 ? 'Money in' : 'Spent'} · type, or drag the number up and down{/if}
	</p>

	<div class="actions">
		<button type="button" class="cancel" onpointerdown={keepFocus} onclick={oncancel}>Cancel</button>
	</div>
</form>

<style>
	.entry {
		position: fixed;
		inset: 0;
		z-index: 10;
		background: #000;
		color: #fff;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 16px;
	}
	.sink {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
		pointer-events: none;
	}
	.to {
		width: 100%;
		max-width: 520px;
		font-size: 1.6rem;
		font-weight: 700;
	}
	.balance {
		margin: -4px 0 0;
		color: #4a4a4a;
		letter-spacing: 0.06em;
		font-variant-numeric: tabular-nums;
	}
	/* Three columns, the outer two always equal (1fr each), so the number
	   stays centered no matter how wide the sign or the enter button is. */
	.line {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		column-gap: 0.12em;
		width: 100%;
		font-size: clamp(6rem, 36vw, 14rem);
		font-weight: 800;
		line-height: 1;
	}
	.line button {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
	}
	.sign {
		justify-self: end;
		width: 0.5em;
		font-size: 0.7em !important;
		color: #ff6b4a !important;
	}
	.sign.plus {
		color: #4ade80 !important;
	}
	.amount {
		position: relative;
		font-variant-numeric: tabular-nums;
		cursor: ns-resize;
		touch-action: none;
		user-select: none;
	}
	.badge {
		position: absolute;
		top: -0.05em;
		right: -0.1em;
		transform: translateX(100%);
		font-size: 0.18em;
		color: #ff6b4a;
		pointer-events: none;
	}
	.badge.up {
		color: #4ade80;
	}
	.hint {
		margin: 0;
		color: #555;
		letter-spacing: 0.06em;
	}
	.error {
		color: #ff8a65;
	}
	.actions {
		position: absolute;
		bottom: calc(24px + env(safe-area-inset-bottom, 0px));
		display: flex;
		gap: 12px;
	}
	.actions button {
		font: inherit;
		font-size: 1.1rem;
		letter-spacing: 0.08em;
		border-radius: 999px;
		padding: 10px 26px;
		cursor: pointer;
	}
	.cancel {
		background: none;
		border: 1px solid #333;
		color: #8a8a8a;
	}
	.line .enter {
		justify-self: start;
		width: 1.1em;
		height: 1.1em;
		margin-left: 0.25em;
		border-radius: 50%;
		background: #fff;
		color: #000;
		font-size: 0.4em;
		font-weight: 700;
		line-height: 1;
		display: grid;
		place-items: center;
		transition: transform 120ms;
	}
	.line .enter:active {
		transform: scale(0.92);
	}
</style>
