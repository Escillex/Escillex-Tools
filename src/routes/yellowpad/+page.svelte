<script lang="ts">
	/*
	 * Yellowpad. Double-clicking a .md file in Explorer opens the installed
	 * app here (file_handlers in the manifest, one window per file) and the
	 * browser hands us the file through launchQueue.
	 */
	import { onMount } from 'svelte';
	import Home from '#lib/yellowpad/Home.svelte';
	import TopBar from '#lib/yellowpad/TopBar.svelte';
	import SaveControl from '#lib/yellowpad/SaveControl.svelte';
	import YellowpadSettings from '#lib/yellowpad/YellowpadSettings.svelte';
	import MarkdownView from '#lib/markdown/MarkdownView.svelte';
	import { toMode, wideScreen, type Mode } from '#lib/markdown/ModeTabs.svelte';
	import { Doc } from '#lib/markdown/doc.svelte.ts';
	import { Saver, watchEdits } from '#lib/yellowpad/saver.svelte.ts';
	import { canSaveInPlace, diskModified, downloadCopy, permission, readHandle, writeFile, type OpenFile } from '#lib/yellowpad/files.ts';
	import { getSetting, setSetting } from '#lib/core/db.ts';
	import { tick } from '#lib/ui/feedback.ts';

	let file = $state<OpenFile | null>(null);
	let error = $state('');
	let settings = $state(false);
	let changedOnDisk = $state(false);
	let mode = $state<Mode>('read');
	const wide = wideScreen();
	const doc = new Doc();

	/** Write the current text. The first write asks for permission, which needs a click or keypress in progress. */
	async function write() {
		const f = file;
		if (!f || !f.utf8) return; // never write a file we couldn't read correctly
		const text = doc.text;
		if (!f.handle) {
			downloadCopy(f, text);
			doc.markSaved(text);
			return;
		}
		if (!(await permission(f.handle, 'readwrite', true))) throw new Error('no permission');
		f.lastModified = await writeFile(f, text);
		doc.markSaved(text);
		changedOnDisk = false;
	}

	const saver = new Saver(write, () => doc.dirty);

	function open(f: OpenFile) {
		file = f;
		doc.load(f.text);
		changedOnDisk = false;
		saver.status = 'idle';
	}

	// Every change to the text (typing, cells, checkboxes, undo) reaches the saver.
	// A file that isn't UTF-8 is read-only: saving would write � over its original characters.
	const readOnly = $derived(!!file && !file.utf8);
	watchEdits(() => doc.text, saver, () => !!file && !readOnly);

	onMount(() => {
		(async () => {
			saver.setAuto(((await getSetting<boolean>('reader:autosave')) ?? false) && canSaveInPlace());
			const m = toMode(await getSetting('reader:mode'));
			if (m) mode = m;
			modeLoaded = true;
		})();

		const queue = (window as unknown as { launchQueue?: { setConsumer: (fn: (p: { files: FileSystemFileHandle[] }) => void) => void } }).launchQueue;
		queue?.setConsumer(async ({ files }) => {
			if (!files?.length) return;
			try {
				open(await readHandle(files[0]));
			} catch {
				error = "Couldn't open that file.";
			}
		});
		return () => saver.dispose();
	});

	// The mode you pick is the one files open in next time. Not before the saved one has loaded, or the default would overwrite it.
	let modeLoaded = $state(false);
	$effect(() => {
		if (modeLoaded) setSetting('reader:mode', mode);
	});

	function setAuto(on: boolean) {
		saver.setAuto(on);
		setSetting('reader:autosave', on);
	}

	/** Coming back to the window: has someone else changed the file? */
	async function checkDisk() {
		const f = file;
		if (!f?.handle) return;
		const at = await diskModified(f.handle);
		if (at === null || at === f.lastModified) return;
		if (!doc.dirty) open(await readHandle(f.handle));
		else changedOnDisk = true;
	}

	async function reload() {
		if (file?.handle) open(await readHandle(file.handle));
	}

	/** Take the disk's current version as "seen": no more asking until it changes again, and the next save overwrites it. */
	async function keepMine() {
		changedOnDisk = false;
		if (file?.handle) file.lastModified = (await diskModified(file.handle)) ?? file.lastModified;
	}

	function onvisibility() {
		if (document.visibilityState === 'visible') checkDisk();
		else if (saver.auto && doc.dirty) saver.save(); // leaving the window: save now in auto mode
	}

	/**
	 * A table cell being edited holds its text in the page until it's committed.
	 * Blurring it commits it into the document (synchronously), so a save or close includes it.
	 */
	function commitOpenEdit() {
		const el = document.activeElement as HTMLElement | null;
		if (el?.isContentEditable || el?.classList.contains('block-box')) el.blur();
	}

	function onkeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && file && !readOnly) {
			e.preventDefault();
			commitOpenEdit();
			saver.save().then(() => saver.status === 'saved' && tick());
		}
	}

	function onbeforeunload(e: BeforeUnloadEvent) {
		const active = document.activeElement as HTMLElement | null;
		const editingCell = active?.isContentEditable || active?.classList.contains('block-box');
		if (file && (saver.pending || editingCell)) e.preventDefault();
	}

	function close() {
		commitOpenEdit();
		if ((doc.dirty || saver.pending) && !confirm('Close without saving?')) return;
		file = null;
	}
</script>

<svelte:window {onkeydown} {onbeforeunload} onfocus={checkDisk} onblur={() => saver.auto && doc.dirty && saver.save()} />
<svelte:document onvisibilitychange={onvisibility} />
<svelte:head><title>{file ? `${doc.dirty ? '• ' : ''}${file.name}` : 'Yellowpad'}</title></svelte:head>

<main class="screen" class:wide={mode === 'split' && wide.current}>
	{#if file}
		<TopBar name={file.name} dirty={doc.dirty} bind:mode wide={wide.current} onsettings={() => (settings = true)} onclose={close}>
			{#snippet save()}
				{#if readOnly}
					<span class="label">Read only</span>
				{:else}
					<SaveControl {saver} inPlace={!!file?.handle} onsave={() => saver.save()} onauto={setAuto} />
				{/if}
			{/snippet}
		</TopBar>

		{#if readOnly}
			<div class="banner">
				<span class="label">Not UTF-8: read only. Saving would damage characters this app can't read.</span>
			</div>
		{/if}

		{#if changedOnDisk}
			<div class="banner">
				<span class="label">Changed on disk</span>
				<button type="button" class="btn small" onclick={reload}>Reload</button>
				<button type="button" class="btn small" onclick={keepMine}>Keep mine</button>
			</div>
		{/if}

		<MarkdownView {doc} {mode} />
	{:else}
		<Home onopen={open} />
		{#if error}<p class="label">{error}</p>{/if}
	{/if}
</main>

{#if settings}
	<YellowpadSettings bind:mode onclose={() => (settings = false)} />
{/if}

<style>
	.screen {
		box-sizing: border-box;
		min-height: 100dvh;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(14px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
	}
	.screen.wide {
		max-width: 1400px;
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		border: 2px solid var(--accent);
		padding: 8px 10px;
		margin-bottom: 14px;
	}
	.banner .label {
		flex: 1;
		color: var(--ink);
	}
	.small {
		font-size: 0.95rem;
		padding: 6px 14px;
	}
</style>
