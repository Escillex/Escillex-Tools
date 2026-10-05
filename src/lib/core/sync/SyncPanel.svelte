<script lang="ts">
	/**
	 * Pair devices and run "Sync all". Lives on the launcher.
	 */
	import { onMount } from 'svelte';
	import { renderSVG } from 'uqr';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { tools } from '#lib/apps.ts';
	import QrScanner from './QrScanner.svelte';
	import { CODE_LENGTH, codeToQr, groupCode, newSyncCode, normalizeCode, parseCode } from './crypto';
	import { cancel, confirmSync, forgetCode, loadCode, saveCode, startSync, sync } from './session.svelte';
	import type { Counts } from './snapshot';

	let { onclose }: { onclose: () => void } = $props();

	let view = $state<'home' | 'show' | 'scan' | 'type'>('home');
	let typed = $state('');
	let typeError = $state('');
	let copied = $state(false);
	let armedUnpair = $state(false);

	onMount(() => {
		loadCode();
	});

	function feedback(strong = false) {
		unlockFeedback();
		tick(strong);
	}

	async function showCode() {
		feedback();
		if (!sync.code) await saveCode(newSyncCode()); // this device starts the pairing
		view = 'show';
	}

	async function paired(code: string) {
		await saveCode(code);
		feedback(true);
		view = 'home';
	}

	/** Keep only code characters and show them in groups of 4 as you type. */
	function onType(e: Event & { currentTarget: HTMLInputElement }) {
		typeError = '';
		const raw = e.currentTarget.value;
		// A pasted older 43-character code: keep it exactly as is.
		if (/^[A-Za-z0-9_-]{43}$/.test(raw.trim())) {
			typed = raw.trim();
			return;
		}
		const clean = normalizeCode(raw).replace(/[^0-9A-Z]/g, '').slice(0, CODE_LENGTH);
		typed = groupCode(clean);
		e.currentTarget.value = typed;
	}
	const typedCount = $derived(normalizeCode(typed).length);

	function onTyped(e: SubmitEvent) {
		e.preventDefault();
		const code = parseCode(typed);
		if (!code) {
			typeError = `That code isn't right. It's ${CODE_LENGTH} letters and numbers, like K7Q2-9XHM-…`;
			return;
		}
		paired(code);
	}

	/** Old long codes are hard to type; this swaps in a new short one (other devices must pair again). */
	async function newCode() {
		await saveCode(newSyncCode());
		feedback(true);
	}
	async function copyCode() {
		if (!sync.code) return;
		try {
			await navigator.clipboard.writeText(shownCode);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard blocked: the code is selectable text, so it can be copied by hand.
		}
	}

	async function unpair() {
		if (!armedUnpair) {
			armedUnpair = true;
			feedback();
			return;
		}
		armedUnpair = false;
		await forgetCode();
		feedback(true);
	}

	function close() {
		if (sync.status.step === 'waiting' || sync.status.step === 'sending') cancel();
		onclose();
	}

	const describe = (c: Counts) => {
		const parts = [];
		if (c.added) parts.push(`${c.added} new`);
		if (c.changed) parts.push(`${c.changed} changed`);
		if (c.deleted) parts.push(`${c.deleted} deleted`);
		return parts.length ? parts.join(' · ') : 'nothing';
	};
	const toolName = (id: string) => tools.find((t) => t.id === id)?.name ?? id;

	/** Short codes show grouped; old long ones as they are. */
	const shownCode = $derived(sync.code ? (sync.code.length === CODE_LENGTH ? groupCode(sync.code) : sync.code) : '');

	const qr = $derived(sync.code ? renderSVG(codeToQr(sync.code), { border: 2, whiteColor: '#fff', blackColor: '#000' }) : '');
</script>

<Sheet title="Sync" onclose={close}>
	{#if sync.status.step !== 'idle'}
		{@const s = sync.status}
		{#if s.step === 'sending'}
			<p class="big display">Locking and sending…</p>
		{:else if s.step === 'waiting'}
			<p class="big display">Waiting for your other device</p>
			<p class="dim">Press <b>Sync all</b> on it too. This keeps checking for up to 10 minutes.</p>
			<button class="btn" type="button" onclick={() => (feedback(), cancel())}>Cancel</button>
		{:else if s.step === 'review'}
			{@const nothing = s.comparison.incoming.added + s.comparison.incoming.changed + s.comparison.incoming.deleted === 0}
			<p class="big display">{nothing ? 'This device is up to date' : 'Ready to merge'}</p>
			<div class="compare">
				<div>
					<span class="label">This device gets</span>
					<span class="in">{describe(s.comparison.incoming)}</span>
				</div>
				<div>
					<span class="label">Your other device gets</span>
					<span class="out">{describe(s.comparison.outgoing)}</span>
				</div>
			</div>
			{#if tools.length > 1}
				{#each Object.entries(s.comparison.byTool) as [id, c] (id)}
					<p class="dim">{toolName(id)}: gets {describe(c.incoming)}, sends {describe(c.outgoing)}</p>
				{/each}
			{/if}
			{#if s.skipped > 0}
				<p class="warn">Ignored {s.skipped} upload{s.skipped > 1 ? 's' : ''} that didn't come from your devices.</p>
			{/if}
			<p class="dim">If the same entry changed on both, the most recent edit wins.</p>
			<button class="btn btn-primary" type="button" onclick={() => (feedback(true), confirmSync())}>{nothing ? 'Done' : 'Merge'}</button>
			<button class="btn" type="button" onclick={() => (feedback(), cancel())}>Cancel</button>
		{:else if s.step === 'applying'}
			<p class="big display">Merging…</p>
		{:else if s.step === 'done'}
			<p class="big display">Synced</p>
			<p class="dim">{s.written === 0 ? 'Nothing needed to change here.' : `Updated ${s.written} entr${s.written === 1 ? 'y' : 'ies'} on this device.`}</p>
			<button class="btn btn-primary" type="button" onclick={() => (feedback(), cancel())}>Done</button>
		{:else if s.step === 'error'}
			<p class="big display">Sync didn't finish</p>
			<p class="warn">{s.message}</p>
			<button class="btn btn-primary" type="button" onclick={() => (feedback(), startSync())}>Try again</button>
			<button class="btn" type="button" onclick={() => cancel()}>Close</button>
		{/if}
	{:else if view === 'show'}
		<p class="dim">On your other device: Tools → Sync → <b>Type a code</b> or <b>Scan a code</b>.</p>
		<p class="code display" class:long={shownCode.length > 30}>{shownCode}</p>
		<button class="btn" type="button" onclick={copyCode}>{copied ? 'Copied' : 'Copy code'}</button>
		<div class="qr" aria-label="Pairing QR code" role="img">{@html qr}</div>
		{#if sync.code && sync.code.length !== CODE_LENGTH}
			<button class="btn" type="button" onclick={newCode}>Switch to a shorter code</button>
			<p class="dim small">Your other devices will need to pair again with the new code.</p>
		{/if}
		<p class="warn small">Anyone with this code can sync with your data. Only show it to your own devices.</p>
		<button class="btn btn-primary" type="button" onclick={() => (feedback(), (view = 'home'))}>Done</button>
	{:else if view === 'type'}
		<form class="typeform" onsubmit={onTyped}>
			<p class="dim">Type the code shown on your other device. Capitals, spaces and dashes don't matter.</p>
			{#if sync.paired}<p class="warn small">This replaces this device's current pairing.</p>{/if}
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="field codeinput"
				aria-label="Pairing code"
				placeholder="K7Q2-9XHM-…"
				value={typed}
				oninput={onType}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck="false"
				autofocus
			/>
			<p class="label count">{typedCount}/{CODE_LENGTH}</p>
			{#if typeError}<p class="warn">{typeError}</p>{/if}
			<button class="btn btn-primary" disabled={!parseCode(typed)}>Pair</button>
			<button class="btn" type="button" onclick={() => (feedback(), (view = 'scan'))}>Scan instead</button>
			<button class="btn" type="button" onclick={() => (view = 'home')}>Back</button>
		</form>
	{:else if view === 'scan'}
		<QrScanner onfound={paired} />
		<button class="btn" type="button" onclick={() => (feedback(), (view = 'type'))}>Type the code instead</button>
		<button class="btn" type="button" onclick={() => (view = 'home')}>Back</button>
	{:else if sync.paired}
		<button class="btn btn-primary sync-all" type="button" onclick={() => (feedback(true), startSync())}>Sync all</button>
		<p class="dim">Press Sync all on two devices at the same time to merge them. Your data is locked with your pairing code before it leaves this device.</p>
		<button class="btn" type="button" onclick={showCode}>Add another device</button>
		<button class="btn" type="button" onclick={() => (feedback(), (view = 'type'))}>Pair with a different code</button>
		<button class="btn" class:btn-danger={armedUnpair} type="button" onclick={unpair}>
			{armedUnpair ? 'Tap again to unpair this device' : 'Unpair this device'}
		</button>
	{:else}
		<p class="dim">Pair your phone and computer to keep your data the same on both. It's locked on your device before it's sent, and the server deletes it after 10 minutes.</p>
		<button class="btn btn-primary" type="button" onclick={showCode}>Show pairing code</button>
		<button class="btn" type="button" onclick={() => (feedback(), (view = 'type'))}>Type a code</button>
		<button class="btn" type="button" onclick={() => (feedback(), (view = 'scan'))}>Scan a code</button>
	{/if}
</Sheet>

<style>
	.big {
		margin: 0;
		font-size: calc(2.2rem / var(--font-wide));
	}
	.dim {
		margin: 0;
		color: var(--dim);
	}
	.warn {
		margin: 0;
		color: var(--danger);
	}
	.small {
		font-size: calc(0.9rem / var(--font-wide));
	}
	.sync-all {
		font-size: calc(1.6rem / var(--font-wide));
		padding: 16px;
	}
	.qr {
		width: min(100%, 260px);
		margin: 0 auto;
		border: 2px solid var(--line);
		overflow: hidden;
		line-height: 0;
	}
	.qr :global(svg) {
		width: 100%;
		height: auto;
	}
	/* The code is meant to be read and typed: big, monospaced, evenly spaced. */
	.code {
		margin: 0;
		text-align: center;
		font-family: ui-monospace, 'JetBrains Mono', Consolas, monospace;
		font-style: normal;
		font-weight: 600;
		font-size: calc(1.55rem / var(--font-wide));
		letter-spacing: 0.06em;
		color: var(--ink);
		overflow-wrap: anywhere;
		user-select: all;
		padding: 10px 0;
		border-top: 2px solid var(--line);
		border-bottom: 2px solid var(--line);
	}
	.code.long {
		font-size: 0.85rem;
		letter-spacing: 0;
	}
	.typeform {
		display: grid;
		gap: 10px;
	}
	.codeinput {
		font-family: ui-monospace, 'JetBrains Mono', Consolas, monospace;
		font-style: normal;
		font-weight: 600;
		font-size: calc(1.45rem / var(--font-wide));
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.count {
		margin: -4px 0 0;
		text-align: right;
	}
	.compare {
		display: grid;
		gap: 8px;
	}
	.compare div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 2px solid var(--line);
	}
	.label {
		color: var(--dim);
	}
	.in {
		color: var(--accent);
	}
	.out {
		color: var(--ink);
	}
</style>
