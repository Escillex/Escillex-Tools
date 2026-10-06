<script lang="ts">
	/** The Reader with no file open: open, new, recent files, and how to make it the default .md app. */
	import { live } from '#lib/live.svelte.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { forgetRecent, listRecent } from './db';
	import { FileAccessBlocked, canSaveInPlace, newFile, permission, pickFile, readHandle, type OpenFile } from './files';
	import WalletLoop from '#lib/ui/WalletLoop.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import type { Recent } from './recent';

	let { onopen }: { onopen: (file: OpenFile) => void } = $props();

	const recent = live(listRecent, []);
	let error = $state('');
	/** This browser refused to read a picked file: offer to open a copy instead. */
	let askCopy = $state(false);

	async function go(get: () => Promise<OpenFile | null>) {
		unlockFeedback();
		tick();
		error = '';
		try {
			const file = await get();
			if (file) onopen(file);
		} catch (e) {
			console.error('Reader: open failed', e);
			if (e instanceof FileAccessBlocked) askCopy = true;
			else error = `Couldn't open that file. (${e instanceof Error ? `${e.name}: ${e.message}` : String(e)})`;
		}
	}

	async function reopen(r: Recent) {
		await go(async () => {
			if (!(await permission(r.handle, 'read', true))) return null;
			try {
				return await readHandle(r.handle);
			} catch {
				await forgetRecent(r.id);
				error = 'File moved or deleted';
				return null;
			}
		});
	}

	const when = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

	/** "B83_next_steps.md" → "B83_next_steps", kept short so one long name doesn't stretch the dial. */
	function title(name: string) {
		const bare = name.replace(/\.(md|markdown)$/i, '');
		return [...bare].length > 24 ? [...bare].slice(0, 23).join('') + '…' : bare;
	}

	// Recent files: always a dial like the wallets, even with one (it just repeats).
	let selected = $state(0);
	const items = $derived(recent.current.map((r) => ({ id: r.id, label: title(r.name) })));
	// The list changed (a file opened, removed): start again from the newest. The {#key} below restarts the dial too,
	// since its position is counted in slots of the old list.
	const listKey = $derived(items.map((i) => i.id).join(','));
	$effect(() => {
		void listKey;
		selected = 0;
	});
	const current = $derived(recent.current[Math.min(selected, recent.current.length - 1)]);

	function remove(r: Recent) {
		tick();
		forgetRecent(r.id);
	}
	const showHint = canSaveInPlace() && !matchMedia('(pointer: coarse)').matches;
</script>

<div class="home">
	<a class="circle" href="/" aria-label="Back to tools">←</a>
	<h1 class="display"><span class="title-bar">Reader</span></h1>

	<div class="buttons">
		<button type="button" class="btn btn-primary" onclick={() => go(pickFile)}>Open file</button>
		<button type="button" class="btn" onclick={() => go(newFile)}>New file</button>
	</div>
	{#if error}<p class="error">{error}</p>{/if}

	{#if current}
		<section class="recent" aria-label="Recent files">
			<p class="label">Recent</p>
			<div class="dial">
				{#key listKey}
					<WalletLoop {items} bind:selected label="Recent file" onactivate={() => reopen(current)} />
				{/key}
			</div>
			{@render card(current, false)}
		</section>
	{/if}

	{#if showHint}
		<p class="label hint">
			Make Reader your default for .md: right-click a .md file → Open with → Choose another app → Reader → Always.
		</p>
	{/if}
</div>

{#if askCopy}
	<Sheet title="Open a copy" onclose={() => (askCopy = false)}>
		<p class="sheet-text">This browser won't let the app read files on your computer directly, so the Reader can't save back to them here.</p>
		<p class="sheet-text">It can open a copy instead: pick the file once more. Saving then downloads it rather than changing the original. You'll only see this once in this browser.</p>
		<!-- This press is the fresh click the browser needs before it shows another file picker. -->
		<button
			type="button"
			class="btn btn-primary"
			onclick={() => {
				askCopy = false;
				go(pickFile);
			}}>Proceed</button
		>
	</Sheet>
{/if}

{#snippet card(r: Recent, named: boolean)}
	<div class="card">
		{#if named}
			<button type="button" class="display name" onclick={() => reopen(r)}>{title(r.name)}</button>
		{/if}
		{#if r.preview}<p class="preview">{r.preview}</p>{/if}
		<div class="row">
			<span class="label when">{when(r.openedAt)}</span>
			<button type="button" class="btn btn-primary small" onclick={() => reopen(r)}>Open</button>
			<button type="button" class="circle" aria-label="Remove {r.name} from recent" onclick={() => remove(r)}>✕</button>
		</div>
	</div>
{/snippet}

<style>
	.home {
		display: grid;
		gap: 14px;
	}
	.home > .circle {
		margin-bottom: 10vh;
	}
	h1 {
		margin: 0 0 8px -0.2em;
		font-size: min(calc(6rem / var(--font-wide)), calc(18vw / var(--font-wide)));
	}
	.buttons {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.error {
		margin: 0;
		color: var(--danger);
	}
	.label {
		margin: 12px 0 0;
	}
	.recent {
		display: grid;
		gap: 10px;
		margin-top: 12px;
	}
	.dial {
		font-size: calc(2.4rem / var(--font-wide));
		border-top: 2px solid var(--line);
		border-bottom: 2px solid var(--line);
		padding: 8px 0;
	}
	.card {
		display: grid;
		gap: 8px;
		border-top: 2px solid var(--line);
		padding-top: 10px;
	}
	.dial + .card {
		border-top: 0;
	}
	.name {
		justify-self: start;
		background: none;
		border: 0;
		padding: 0;
		color: var(--ink);
		font-size: calc(2rem / var(--font-wide));
		cursor: pointer;
		text-align: left;
	}
	/* A taste of what's inside: the first lines, greyed out, cut off after four. */
	.preview {
		margin: 0;
		font-family: var(--font-read);
		font-style: normal;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--dim);
		white-space: pre-line;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.when {
		flex: 1;
		margin: 0;
	}
	.small {
		font-size: 0.95rem;
		padding: 6px 16px;
	}
	.sheet-text {
		margin: 0;
		font-family: var(--font-read);
		font-style: normal;
		line-height: 1.5;
	}
	.hint {
		margin-top: 24px;
		line-height: 1.6;
	}
</style>
