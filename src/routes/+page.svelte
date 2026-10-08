<script lang="ts">
	// The launcher: tools.escillex.com opens here. A clock dial of tools
	// (turn to choose, tap or pull to open) and the app-wide keys along the bottom.
	import { goto } from '$app/navigation';
	import { tools } from '#lib/apps.ts';
	import { install } from '#lib/core/install.svelte.ts';
	import { update } from '#lib/core/update.svelte.ts';
	import { saving } from '#lib/core/saving.svelte.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import Sheet from '#lib/ui/Sheet.svelte';
	import SyncPanel from '#lib/core/sync/SyncPanel.svelte';
	import SettingsPanel from '#lib/core/SettingsPanel.svelte';
	import BackupPanel from '#lib/core/backup/BackupPanel.svelte';
	import { loadCode, sync } from '#lib/core/sync/session.svelte.ts';
	import Dial from '#lib/launcher/Dial.svelte';
	import type { DialTool } from '#lib/launcher/dial.ts';
	import { curtain } from '#lib/ui/transition/state.svelte.ts';
	import { toolNumber } from '#lib/ui/transition/plan.ts';
	import { onMount } from 'svelte';

	let open = $state<'sync' | 'settings' | 'backup' | 'install' | null>(null);
	let openedFile = $state<File | null>(null);

	// Desktop: double-clicking a .escb file launches the installed app here
	// (see file_handlers in the manifest) and the browser hands us the file.
	onMount(() => {
		const queue = (window as unknown as { launchQueue?: { setConsumer: (fn: (p: { files: FileSystemFileHandle[] }) => void) => void } }).launchQueue;
		queue?.setConsumer(async ({ files }) => {
			if (!files?.length) return;
			openedFile = await files[0].getFile();
			open = 'backup';
		});
	});

	function show(panel: 'sync' | 'settings' | 'backup') {
		unlockFeedback();
		tick();
		open = panel;
	}

	async function onInstall() {
		unlockFeedback();
		tick();
		if (install.canPrompt) await install.prompt();
		else open = 'install';
	}

	function onUpdate() {
		unlockFeedback();
		tick();
		if (update.status === 'ready') update.apply();
		else if (update.status !== 'checking') update.check();
	}

	const updateLabel = $derived(
		{ idle: 'Update', checking: 'Checking', ready: 'Restart', latest: 'Latest', offline: 'Offline' }[update.status]
	);

	const canInstall = $derived(!install.installed && (install.canPrompt || install.needsManualSteps));

	/* ---------- the dial ---------- */

	const store = {
		get(key: string) {
			try {
				return localStorage.getItem(key);
			} catch {
				return null;
			}
		},
		set(key: string, value: string) {
			try {
				localStorage.setItem(key, value);
			} catch {
				/* private mode: just not remembered */
			}
		}
	};

	onMount(loadCode);

	const dialTools: DialTool[] = tools.map((t) => ({ id: t.id, name: t.name, href: t.href, line: t.description }));
	let selected = $state(Math.max(0, tools.findIndex((t) => t.id === store.get('launcher:last'))));
	const hinted = store.get('launcher:hinted') === '1';

	function launch(i: number) {
		const t = dialTools[i];
		store.set('launcher:last', t.id);
		store.set('launcher:hinted', '1');
		curtain.arm({ title: t.name, number: toolNumber(i), line: t.line, fling: true, at: performance.now() });
		goto(t.href);
	}

	const today = new Date()
		.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })
		.replace(/,/g, '')
		.toUpperCase();
</script>

<!-- Tool pages set their own title; coming back here has to set it again. -->
<svelte:head><title>Tools</title></svelte:head>

<div class="screen">
	<header class="strip">
		<span class="label">{today} · {tools.length} {tools.length === 1 ? 'tool' : 'tools'}</span>
		{#if saving.progress}
			{@const p = saving.progress}
			<span class="label">{p.update ? 'Downloading update' : 'Saving for offline'} · {p.done}/{p.total}</span>
			<!-- The strip's bottom line fills up as files arrive. -->
			<i class="saved" role="progressbar" aria-label="Saving for offline" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} style:--p={p.done / p.total}></i>
		{:else if sync.paired}
			<span class="label">Paired</span>
		{/if}
	</header>
	{#if !hinted}<p class="label hint">Turn ▲▼ · tap or pull › to open</p>{/if}

	<!-- The dial bleeds past the page gutter to the screen edges. -->
	<div class="dial-wrap"><Dial tools={dialTools} bind:selected onlaunch={launch} /></div>

	<div class="keys">
		<button type="button" class="key" onclick={() => show('sync')}><span class="glyph">→</span><span class="display">Sync</span></button>
		<button type="button" class="key" onclick={() => show('backup')}><span class="glyph">→</span><span class="display">Backup</span></button>
		<button type="button" class="key" onclick={() => show('settings')}><span class="glyph">→</span><span class="display">Settings</span></button>
		<button type="button" class="key" onclick={onUpdate} aria-live="polite"><span class="glyph">↻</span><span class="display">{updateLabel}</span></button>
		{#if canInstall}
			<button type="button" class="key" onclick={onInstall}><span class="glyph">↓</span><span class="display">Install</span></button>
		{/if}
	</div>
</div>

{#if open === 'sync'}
	<SyncPanel onclose={() => (open = null)} />
{:else if open === 'backup'}
	<BackupPanel file={openedFile} onclose={() => ((open = null), (openedFile = null))} />
{:else if open === 'settings'}
	<SettingsPanel onclose={() => (open = null)} />
{:else if open === 'install'}
	<Sheet title="Install on iPhone" onclose={() => (open = null)}>
		<ol>
			<li>Tap the <b>Share</b> button in Safari's toolbar (the square with an arrow).</li>
			<li>Scroll down and tap <b>Add to Home Screen</b>.</li>
			<li>Tap <b>Add</b>. Open it from your home screen from now on.</li>
		</ol>
		<p class="label">Install before adding data: Safari and the installed app keep separate storage.</p>
		<button type="button" class="btn btn-primary" onclick={() => (open = null)}>Got it</button>
	</Sheet>
{/if}

<style>
	.screen {
		position: relative;
		min-height: 100dvh;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: calc(18px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
		/* The dial runs off the left edge, so the screen itself isn't capped; only the strip and keys are. */
		overflow: hidden;
	}
	.strip,
	.hint,
	.keys {
		width: 100%;
		max-width: 620px;
		margin-inline: auto;
	}
	.dial-wrap {
		flex: 1;
		display: flex;
		margin-inline: -16px;
	}
	.strip {
		position: relative;
		display: flex;
		justify-content: space-between;
		padding-bottom: 8px;
		border-bottom: 2px solid var(--line);
	}
	/* While saving, the strip's line dims into a track and the bar fills it left to right. */
	.strip:has(.saved) {
		border-bottom-color: var(--faint);
	}
	.saved {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2px;
		height: 2px;
		background: var(--accent);
		transform: scaleX(var(--p));
		transform-origin: left;
		transition: transform 200ms ease-out;
	}
	.hint {
		margin-top: -4px;
		margin-bottom: 0;
	}
	.keys {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: 8px;
		align-items: end;
		height: 64px;
	}
	/* A keycap: the thick bottom border is its depth. Pressing sinks it by that depth. */
	.key {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		align-items: flex-start;
		height: 58px;
		box-sizing: border-box;
		padding: 6px 8px 6px 10px;
		background: var(--bg);
		color: var(--ink);
		border: 2px solid var(--ink);
		border-bottom-width: 8px;
		cursor: pointer;
		text-align: left;
		transition:
			height 60ms,
			border-bottom-width 60ms;
	}
	.key:active {
		height: 52px;
		border-bottom-width: 2px;
		background: var(--ink);
		color: var(--bg);
	}
	.key .display {
		font-size: calc(1.1rem / var(--font-wide));
		white-space: nowrap;
	}
	.glyph {
		font-family: var(--font-mono);
		font-style: normal;
		font-size: 0.75rem;
		color: var(--dim);
	}
	.key:active .glyph {
		color: var(--bg);
	}
	ol {
		margin: 0;
		padding-left: 1.2em;
		display: grid;
		gap: 8px;
	}
</style>
