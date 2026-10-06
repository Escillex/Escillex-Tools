<script lang="ts">
	// The launcher: tools.escillex.com opens here. One big word per tool,
	// and a list of app-wide actions along the bottom.
	import { tools } from '#lib/apps.ts';
	import { install } from '#lib/core/install.svelte.ts';
	import { update } from '#lib/core/update.svelte.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import SyncPanel from '#lib/core/sync/SyncPanel.svelte';
	import SettingsPanel from '#lib/core/SettingsPanel.svelte';
	import BackupPanel from '#lib/core/backup/BackupPanel.svelte';
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
		{ idle: 'Update', checking: 'Checking…', ready: 'Restart to update', latest: 'Up to date', offline: 'Offline' }[update.status]
	);

	const canInstall = $derived(!install.installed && (install.canPrompt || install.needsManualSteps));
</script>

<!-- Tool pages set their own title; coming back here has to set it again. -->
<svelte:head><title>Tools</title></svelte:head>

<div class="screen">
	<Wordmark />

	<nav>
		{#each tools as tool (tool.id)}
			<a class="display tool" href={tool.href} onpointerdown={() => (unlockFeedback(), tick())}>{tool.name}</a>
		{/each}
	</nav>

	<div class="actions">
		<button type="button" class="row" onclick={() => show('sync')}>
			<span class="display">Sync</span><span class="circle" aria-hidden="true">→</span>
		</button>
		<button type="button" class="row" onclick={() => show('backup')}>
			<span class="display">Backup</span><span class="circle" aria-hidden="true">→</span>
		</button>
		<button type="button" class="row" onclick={() => show('settings')}>
			<span class="display">Settings</span><span class="circle" aria-hidden="true">→</span>
		</button>
		<button type="button" class="row" onclick={onUpdate} aria-live="polite">
			<span class="display">{updateLabel}</span><span class="circle" aria-hidden="true">↻</span>
		</button>
		{#if canInstall}
			<button type="button" class="row" onclick={onInstall}>
				<span class="display">Install app</span><span class="circle" aria-hidden="true">↓</span>
			</button>
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
		padding: calc(18px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
		max-width: 620px;
		margin: 0 auto;
	}
	nav {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.1em;
	}
	.tool {
		color: var(--ink);
		text-decoration: none;
		font-size: min(calc(11rem / var(--font-wide)), calc(30vw / var(--font-wide)));
		transition: transform 120ms;
	}
	.tool:active {
		transform: scale(0.96);
	}
	.actions {
		display: grid;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: none;
		border: 0;
		border-top: 2px solid var(--line);
		color: var(--ink);
		padding: 10px 0;
		font-size: calc(1.9rem / var(--font-wide));
		cursor: pointer;
		text-align: left;
	}
	.row:active .circle {
		background: var(--ink);
		color: var(--bg);
	}
	ol {
		margin: 0;
		padding-left: 1.2em;
		display: grid;
		gap: 8px;
	}
</style>
