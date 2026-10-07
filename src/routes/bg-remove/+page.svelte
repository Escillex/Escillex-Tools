<script lang="ts">
	/*
	 * BG REMOVE. Everything happens on this device: the model downloads once
	 * (only when you press the button), then cutouts work offline. Finished
	 * cutouts go to a 7-day history on this device.
	 */
	import { onMount } from 'svelte';
	import WalletLoop from '#lib/ui/WalletLoop.svelte';
	import Picker from '#lib/bgremove/Picker.svelte';
	import Drop from '#lib/bgremove/Drop.svelte';
	import Result from '#lib/bgremove/Result.svelte';
	import Thumb from '#lib/bgremove/Thumb.svelte';
	import HistoryGrid from '#lib/bgremove/HistoryGrid.svelte';
	import DeletePrompt from '#lib/bgremove/DeletePrompt.svelte';
	import BgSettings from '#lib/bgremove/BgSettings.svelte';
	import { Engine } from '#lib/bgremove/engine.svelte.ts';
	import { MODELS, defaultModel, isDownloaded, modelById, usable, type Device, type ModelId } from '#lib/bgremove/models.ts';
	import { cachedModelUrls, detectDevice, removeModel, runtimeCached } from '#lib/bgremove/device.ts';
	import { pickVariant } from '#lib/bgremove/runtime.ts';
	import { RUNTIME } from '#lib/bgremove/ort.generated.ts';
	import { mb, progressLabel } from '#lib/bgremove/progress.ts';
	import { acceptFile, expiryLabel, outName, type Cutout } from '#lib/bgremove/history.ts';
	import { clearCutouts, deleteCutout, listCutouts, pruneCutouts, saveCutout } from '#lib/bgremove/db.ts';
	import { DEFAULT_PREFS, SKIP_MS, loadPrefs, savePref, shouldPrompt, type Prefs } from '#lib/bgremove/prefs.ts';
	import { swipeAction } from '#lib/bgremove/gesture.ts';
	import { downloadBlob } from '#lib/bgremove/download.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';

	const engine = new Engine();

	let device = $state<Device | null>(null);
	let model = $state<ModelId>('fast');
	let downloaded = $state(new Set<ModelId>());
	let runtimeReady = $state(false);
	let prefs = $state<Prefs>({ ...DEFAULT_PREFS });

	let file = $state<File | null>(null);
	let before = $state('');
	let after = $state('');
	let result = $state<Blob | null>(null);
	let error = $state<{ kind: string; text: string } | null>(null);
	let notice = $state('');

	let items = $state<Cutout[]>([]);
	let urls = $state(new Map<string, string>());
	let selected = $state(0);
	let pinned = $state<string | null>(null);
	let grid = $state(false);
	let held = $state(false);
	let heldDy = $state(0);
	let now = $state(Date.now());
	let asking = $state<string | null>(null);
	let settings = $state(false);

	const spec = $derived(modelById(model)!);
	const variant = $derived(device ? pickVariant(navigator.userAgent, device.webgpu) : 'asyncify');
	const toDownload = $derived((downloaded.has(model) ? 0 : spec.bytes) + (runtimeReady ? 0 : RUNTIME[variant].bytes));
	const totalBytes = $derived(items.reduce((s, c) => s + c.bytes, 0));
	const busy = $derived(engine.status !== 'idle');
	const centred = $derived(items[selected]);

	async function refreshDownloads() {
		const keys = await cachedModelUrls();
		downloaded = new Set(MODELS.filter((m) => isDownloaded(m, keys)).map((m) => m.id));
		runtimeReady = await runtimeCached(RUNTIME[variant].wasm);
	}

	async function refreshHistory(focusNewest = false) {
		const list = await listCutouts();
		for (const u of urls.values()) URL.revokeObjectURL(u);
		urls = new Map(list.map((c) => [c.id, URL.createObjectURL(c.thumb)]));
		items = list;
		if (focusNewest || selected >= list.length) selected = Math.max(0, list.length - 1);
		if (pinned && !list.some((c) => c.id === pinned)) pinned = null;
	}

	onMount(() => {
		(async () => {
			const [d, p] = await Promise.all([detectDevice(), loadPrefs()]);
			device = d;
			prefs = p;
			model = defaultModel(d, p.model);
			await refreshDownloads();
			await pruneCutouts(Date.now(), prefs.keep);
			await refreshHistory(true);
		})();
		// Expiry badges count down; a local clock tick, no network.
		const clock = setInterval(() => (now = Date.now()), 60_000);
		return () => {
			clearInterval(clock);
			engine.dispose();
			for (const u of urls.values()) URL.revokeObjectURL(u);
			if (before) URL.revokeObjectURL(before);
			if (after) URL.revokeObjectURL(after);
		};
	});

	function pick(f: File) {
		if (busy) return;
		if (!acceptFile(f)) {
			error = { kind: 'image', text: "Couldn't read that image." };
			return;
		}
		error = null;
		notice = '';
		file = f;
		if (before) URL.revokeObjectURL(before);
		if (after) URL.revokeObjectURL(after);
		before = URL.createObjectURL(f);
		after = '';
		result = null;
	}

	function onpaste(e: ClipboardEvent) {
		const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
		if (f) pick(f);
	}

	const MESSAGES: Record<string, string> = {
		memory: 'Not enough memory for this model. Try Balanced or Fast.',
		network: 'Download failed. Check your connection and retry.',
		image: "Couldn't read that image.",
		failed: 'Something went wrong. Retry?'
	};

	async function run() {
		if (!file || !device || busy) return;
		unlockFeedback();
		error = null;
		notice = '';
		const r = await engine.cutout(spec, device.webgpu ? 'webgpu' : 'wasm', variant, file, toDownload, downloaded.has(model));
		await refreshDownloads();
		if (r.type === 'cancelled') return;
		if (r.type === 'error') {
			console.error('BG REMOVE:', r.message);
			error = { kind: r.kind, text: MESSAGES[r.kind] };
			return;
		}
		tick(true);
		result = r.png;
		after = URL.createObjectURL(r.png);
		prefs.model = model;
		savePref('model', model);
		if (!prefs.autosave) return;
		try {
			const { removed } = await saveCutout(
				{ id: crypto.randomUUID(), name: outName(file.name), createdAt: Date.now(), bytes: r.png.size, blob: r.png, thumb: r.thumb },
				prefs.keep
			);
			if (removed) notice = `Removed ${removed} old cutout${removed === 1 ? '' : 's'} to make room.`;
		} catch {
			notice = 'Not enough space to save this one to history. Download it instead.';
		}
		await refreshHistory(true);
	}

	function switchTo(id: ModelId) {
		model = id;
		run();
	}

	async function forget(id: ModelId) {
		await removeModel(modelById(id)!);
		await refreshDownloads();
	}

	/* ---------- history actions ---------- */

	const find = (id: string) => items.find((c) => c.id === id);

	function download(id: string) {
		const c = find(id);
		if (c) downloadBlob(c.blob, c.name);
	}

	function requestDelete(id: string, instant: boolean) {
		if (instant || !shouldPrompt(prefs, Date.now())) return remove(id);
		asking = id;
	}

	async function remove(id: string) {
		await deleteCutout(id);
		if (pinned === id) pinned = null;
		await refreshHistory();
	}

	function confirmDelete(skip: boolean) {
		const id = asking;
		asking = null;
		if (skip) change('skipUntil', Date.now() + SKIP_MS);
		if (id) remove(id);
	}

	function change<K extends keyof Prefs>(k: K, v: Prefs[K]) {
		prefs[k] = v;
		savePref(k, v);
		if (k === 'keep') pruneCutouts(Date.now(), prefs.keep).then(() => refreshHistory());
	}

	async function clearAll() {
		if (!confirm(`Delete all ${items.length} cutouts?`)) return;
		await clearCutouts();
		await refreshHistory();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Delete' || asking || settings) return;
		if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"]')) return;
		const id = pinned ?? (grid ? null : centred?.id);
		if (!id) return;
		e.preventDefault();
		requestDelete(id, e.shiftKey);
	}

	function dialActivate(e: PointerEvent | KeyboardEvent) {
		if (!centred) return;
		if (e.ctrlKey && e.shiftKey) return requestDelete(centred.id, true);
		pinned = pinned === centred.id ? null : centred.id;
	}

	function holdEnd(dy: number) {
		held = false;
		const a = swipeAction(dy);
		if (!centred) return;
		if (a === 'download') download(centred.id);
		else if (a === 'delete') requestDelete(centred.id, false);
	}

	function jumpTo(id: string) {
		const i = items.findIndex((c) => c.id === id);
		if (i >= 0) selected = i;
		grid = false;
	}

	function reset() {
		if (after) URL.revokeObjectURL(after);
		after = '';
		result = null;
		file = null;
	}
</script>

<svelte:window {onpaste} {onkeydown} />
<svelte:head><title>BG REMOVE</title></svelte:head>

<main class="screen">
	<header class="top">
		<h1 class="display">BG REMOVE</h1>
		<button type="button" class="circle" aria-label="Settings" onclick={() => (settings = true)}>⚙</button>
	</header>

	{#if after && result}
		<Result {before} {after} ondownload={() => file && result && downloadBlob(result, outName(file.name))} />
		<button type="button" class="btn" onclick={reset}>New photo</button>
	{:else if file}
		<figure class="preview"><img src={before} alt="The one you picked" /></figure>
		{#if device}
			<Picker {device} bind:selected={model} {downloaded} disabled={busy} onremove={forget} />
		{/if}

		{#if engine.status === 'downloading' && !engine.progress.total}
			<!-- Everything's on this device already: just reading the model back. -->
			<p class="label">Loading model…</p>
		{:else if engine.status === 'downloading'}
			<div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={engine.progress.total} aria-valuenow={engine.progress.loaded}>
				<div class="fill" style:width="{engine.progress.total ? (100 * engine.progress.loaded) / engine.progress.total : 0}%"></div>
			</div>
			<div class="row">
				<span class="label">Downloading {progressLabel(engine.progress)}</span>
				<button type="button" class="btn small" onclick={() => engine.cancel()}>Cancel</button>
			</div>
		{:else if engine.status === 'working'}
			<p class="label">Removing the background…</p>
		{:else}
			<button type="button" class="btn btn-primary" disabled={!device || !usable(spec, device)} onclick={run}>
				Remove background{toDownload ? ` (downloads ${mb(toDownload)} once)` : ''}
			</button>
			<button type="button" class="btn" onclick={() => (file = null)}>Pick another</button>
		{/if}
	{:else}
		<Drop onfile={pick} />
	{/if}

	{#if error}
		<div class="banner">
			<span class="label">{error.text}</span>
			{#if error.kind === 'memory' && device}
				{#each MODELS.filter((m) => m.id !== model && m.bytes < spec.bytes && usable(m, device!)) as m (m.id)}
					<button type="button" class="btn small" onclick={() => switchTo(m.id)}>Try {m.name}</button>
				{/each}
			{:else if error.kind !== 'image' && file}
				<button type="button" class="btn small" onclick={run}>Retry</button>
			{/if}
		</div>
	{/if}
	{#if notice}<p class="label">{notice}</p>{/if}

	{#if prefs.autosave && items.length}
		<section class="history">
			<div class="row">
				<span class="label">History · {items.length} · {mb(totalBytes)}</span>
				<button type="button" class="btn small" onclick={() => ((grid = !grid), (pinned = null))}>{grid ? 'Dial' : 'All'}</button>
			</div>
			{#if grid}
				<HistoryGrid
					{items}
					{urls}
					{now}
					bind:newestFirst={() => prefs.newestFirst, (v) => change('newestFirst', v)}
					bind:pinned
					onpick={jumpTo}
					ondownload={download}
					ondelete={requestDelete}
				/>
			{:else}
				<div class="dial">
					<WalletLoop
						items={items.map((c) => ({ id: c.id, label: c.name }))}
						bind:selected
						label="Saved cutouts"
						slotWidth={136}
						onactivate={dialActivate}
						ondouble={() => centred && download(centred.id)}
						onhold={() => ((held = true), (heldDy = 0), (pinned = null))}
						onholdmove={(dy) => (heldDy = dy)}
						onholdend={holdEnd}
					>
						{#snippet item(it, isCentred)}
							{@const c = find(it.id)}
							{#if c}
								<div class="dial-slot">
									<Thumb
										src={urls.get(c.id) ?? ''}
										badge={expiryLabel(c, now)}
										pinned={isCentred && pinned === c.id}
										held={isCentred && held}
										dy={heldDy}
										ondownload={() => download(c.id)}
										ondelete={(e) => requestDelete(c.id, e.ctrlKey && e.shiftKey)}
									/>
								</div>
							{/if}
						{/snippet}
					</WalletLoop>
				</div>
			{/if}
		</section>
	{/if}
</main>

{#if asking}
	<DeletePrompt onconfirm={confirmDelete} oncancel={() => (asking = null)} />
{/if}
{#if settings}
	<BgSettings {prefs} count={items.length} {totalBytes} onchange={change} onclear={clearAll} onclose={() => (settings = false)} />
{/if}

<style>
	.screen {
		box-sizing: border-box;
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		display: grid;
		gap: 14px;
		align-content: start;
		padding: calc(14px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 2px solid var(--line);
		padding-bottom: 8px;
	}
	h1 {
		margin: 0;
		font-size: calc(2.4rem / var(--font-wide));
	}
	.preview {
		margin: 0;
		display: grid;
		place-items: center;
	}
	.preview img {
		max-width: 100%;
		max-height: 40dvh;
		object-fit: contain;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
	}
	.progress {
		height: 10px;
		border: 2px solid var(--line);
	}
	.fill {
		height: 100%;
		background: var(--accent);
		transition: width 120ms linear;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		border: 2px solid var(--accent);
		padding: 8px 10px;
	}
	.banner .label {
		flex: 1;
		color: var(--ink);
	}
	.history {
		display: grid;
		gap: 10px;
		border-top: 2px solid var(--line);
		padding-top: 10px;
	}
	/* Tall enough for a thumbnail plus the hold hints above and below it (the loop clips its overflow). */
	.dial {
		--loop-h: 184px;
	}
	.dial-slot {
		padding-top: 28px;
	}
	.small {
		font-size: 0.95rem;
		padding: 6px 14px;
	}
</style>
