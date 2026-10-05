<script lang="ts">
	/**
	 * Make a password-protected .escb backup, or restore from one.
	 * Restoring shows the same comparison as Sync, then lets you merge
	 * (newest wins) or replace everything on this device.
	 */
	import { onMount } from 'svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { getSetting, setSetting } from '#lib/core/db.ts';
	import { applyRemotes, buildSnapshot, compare, isSnapshot, replaceWith, type Comparison, type Counts, type Snapshot } from '#lib/core/sync/snapshot.ts';
	import { BackupError, EXTENSION, MIME, backupFileName, decodeBackup, encodeBackup, looksLikeBackup } from './format';
	import { INSECURE_MESSAGE, secureEnough } from '#lib/core/sync/session.svelte.ts';

	let { onclose, file = null }: { onclose: () => void; file?: File | null } = $props();

	type View =
		| { step: 'home' }
		| { step: 'make' }
		| { step: 'made'; name: string }
		| { step: 'unlock'; file: File; bytes: Uint8Array<ArrayBuffer> }
		| { step: 'review'; snapshot: Snapshot; comparison: Comparison; fileName: string }
		| { step: 'restored'; written: number };

	let view = $state<View>({ step: 'home' });
	let password = $state('');
	let confirm = $state('');
	let busy = $state(false);
	let error = $state('');
	let lastBackup = $state<number | null>(null);
	let armedReplace = $state(false);
	let picker = $state<HTMLInputElement>();

	onMount(async () => {
		lastBackup = (await getSetting<number>('lastBackupAt')) ?? null;
		if (file) openFile(file); // opened by double-clicking a .escb file
	});

	function reset(next: View) {
		password = '';
		confirm = '';
		error = '';
		busy = false;
		armedReplace = false;
		view = next;
	}

	/* ---------- making a backup ---------- */
	const makeError = $derived(
		password.length < 8 ? 'Use at least 8 characters.' : confirm !== password ? "The passwords don't match." : ''
	);

	/** Save a file: the system save dialog where available, the share sheet on phones, otherwise a download. */
	async function saveFile(blob: Blob, name: string): Promise<boolean> {
		const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle> };
		if (w.showSaveFilePicker) {
			try {
				const handle = await w.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Tools backup', accept: { [MIME]: [EXTENSION] } }] });
				const out = await handle.createWritable();
				await out.write(blob);
				await out.close();
				return true;
			} catch (e) {
				if ((e as Error).name === 'AbortError') return false; // you closed the dialog
			}
		}
		const asFile = new File([blob], name, { type: MIME });
		if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [asFile] })) {
			try {
				await navigator.share({ files: [asFile], title: name });
				return true;
			} catch (e) {
				if ((e as Error).name === 'AbortError') return false;
			}
		}
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
		setTimeout(() => URL.revokeObjectURL(url), 2000);
		return true;
	}

	async function make(e: SubmitEvent) {
		e.preventDefault();
		if (makeError || busy) return;
		busy = true;
		try {
			const blob = await encodeBackup(await buildSnapshot(), password);
			const name = backupFileName();
			if (await saveFile(blob, name)) {
				lastBackup = Date.now();
				await setSetting('lastBackupAt', lastBackup);
				tick(true);
				reset({ step: 'made', name });
			} else busy = false;
		} catch {
			busy = false;
			error = "Couldn't make the backup. Try again.";
		}
	}

	/* ---------- restoring ---------- */
	async function openFile(f: File) {
		error = '';
		const bytes = new Uint8Array(await f.arrayBuffer());
		if (!looksLikeBackup(bytes)) {
			error = `"${f.name}" isn't a Tools backup. Backups end in ${EXTENSION}.`;
			return;
		}
		reset({ step: 'unlock', file: f, bytes });
	}

	async function unlock(e: SubmitEvent) {
		e.preventDefault();
		if (view.step !== 'unlock' || !password || busy) return;
		busy = true;
		error = '';
		try {
			const data = await decodeBackup<unknown>(view.bytes, password);
			if (!isSnapshot(data)) throw new BackupError("This backup's contents aren't readable.", 'not-a-backup');
			const comparison = compare(await buildSnapshot(), [data]);
			const fileName = view.file.name;
			tick(true);
			reset({ step: 'review', snapshot: data, comparison, fileName });
		} catch (err) {
			busy = false;
			error = err instanceof BackupError ? err.message : "Couldn't open the backup.";
		}
	}

	async function restore(mode: 'merge' | 'replace') {
		if (view.step !== 'review') return;
		if (mode === 'replace' && !armedReplace) {
			armedReplace = true;
			tick();
			return;
		}
		busy = true;
		const written = mode === 'merge' ? await applyRemotes([view.snapshot]) : await replaceWith(view.snapshot);
		tick(true);
		reset({ step: 'restored', written });
	}

	const describe = (c: Counts) => {
		const parts = [];
		if (c.added) parts.push(`${c.added} new`);
		if (c.changed) parts.push(`${c.changed} changed`);
		if (c.deleted) parts.push(`${c.deleted} deleted`);
		return parts.length ? parts.join(' · ') : 'nothing';
	};
	const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<Sheet title="Backup" {onclose}>
	{#if !secureEnough()}
		<p class="error">{INSECURE_MESSAGE}</p>
	{:else if view.step === 'home'}
		<p class="label">{lastBackup ? `Last backup: ${when(lastBackup)}` : 'No backup made on this device yet.'}</p>
		<button class="btn btn-primary" type="button" onclick={() => (unlockFeedback(), tick(), reset({ step: 'make' }))}>Make a backup</button>
		<button class="btn" type="button" onclick={() => picker?.click()}>Restore from a file</button>
		<input bind:this={picker} type="file" accept="{EXTENSION},{MIME}" hidden onchange={(e) => e.currentTarget.files?.[0] && openFile(e.currentTarget.files[0])} />
		{#if error}<p class="error">{error}</p>{/if}
		<p class="label">A backup is one {EXTENSION} file with all your data, locked with a password you choose. Keep it somewhere safe, like cloud storage.</p>
	{:else if view.step === 'make'}
		<form class="form" onsubmit={make}>
			<label>Password<input class="field" type="password" autocomplete="new-password" bind:value={password} /></label>
			<label>Type it again<input class="field" type="password" autocomplete="new-password" bind:value={confirm} /></label>
			<p class="warn">There's no way to recover a forgotten password. Without it, the backup can't be opened by anyone, including you.</p>
			{#if (password || confirm) && makeError}<p class="label">{makeError}</p>{/if}
			{#if error}<p class="error">{error}</p>{/if}
			<button class="btn btn-primary" disabled={!!makeError || busy}>{busy ? 'Locking…' : 'Save backup'}</button>
			<button class="btn" type="button" onclick={() => reset({ step: 'home' })}>Back</button>
		</form>
	{:else if view.step === 'made'}
		<p class="big display">Backup saved</p>
		<p class="label">{view.name}</p>
		<button class="btn btn-primary" type="button" onclick={() => reset({ step: 'home' })}>Done</button>
	{:else if view.step === 'unlock'}
		<form class="form" onsubmit={unlock}>
			<p class="label">{view.file.name}</p>
			<!-- svelte-ignore a11y_autofocus -->
			<label>Backup password<input class="field" type="password" autocomplete="current-password" bind:value={password} autofocus /></label>
			{#if error}<p class="error">{error}</p>{/if}
			<button class="btn btn-primary" disabled={!password || busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
			<button class="btn" type="button" onclick={() => reset({ step: 'home' })}>Cancel</button>
		</form>
	{:else if view.step === 'review'}
		{@const c = view.comparison}
		<p class="big display">Backup unlocked</p>
		<p class="label">Made {when(view.snapshot.at)} · {view.fileName}</p>
		<div class="compare">
			<div><span class="label">This device would get</span><span>{describe(c.incoming)}</span></div>
			<div><span class="label">Newer here than in the backup</span><span>{describe(c.outgoing)}</span></div>
		</div>
		<button class="btn btn-primary" type="button" disabled={busy} onclick={() => restore('merge')}>Merge</button>
		<p class="label">Adds what's missing and keeps the newest version of everything.</p>
		<button class="btn" class:btn-danger={armedReplace} type="button" disabled={busy} onclick={() => restore('replace')}>
			{armedReplace ? 'Tap again to replace everything' : 'Replace everything'}
		</button>
		<p class="label">Makes this device exactly match the backup. Anything newer here is lost.</p>
	{:else if view.step === 'restored'}
		<p class="big display">Restored</p>
		<p class="label">{view.written === 0 ? 'Nothing needed to change.' : `Updated ${view.written} entr${view.written === 1 ? 'y' : 'ies'}.`}</p>
		<button class="btn btn-primary" type="button" onclick={onclose}>Done</button>
	{/if}
</Sheet>

<style>
	.form {
		display: grid;
		gap: 12px;
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
	p {
		margin: 0;
	}
	.big {
		font-size: calc(2.2rem / var(--font-wide));
	}
	.warn {
		color: var(--ink);
		border-left: 4px solid var(--accent);
		padding-left: 10px;
	}
	.error {
		color: var(--danger);
	}
	.compare {
		display: grid;
	}
	.compare div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 0;
		border-bottom: 2px solid var(--line);
	}
</style>
