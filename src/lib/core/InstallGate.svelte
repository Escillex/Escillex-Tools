<script lang="ts">
	/**
	 * Shown instead of the app in Safari (see install.svelte.ts for why).
	 * Just the steps to install, plus a way out for anyone who already
	 * saved data in the browser: export a backup, restore it in the app.
	 */
	import { onMount } from 'svelte';
	import { tools } from '#lib/apps.ts';
	import { install } from '#lib/core/install.svelte.ts';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import Wordmark from '#lib/ui/Wordmark.svelte';
	import BackupPanel from '#lib/core/backup/BackupPanel.svelte';

	let hasData = $state(false);
	let backupOpen = $state(false);

	onMount(async () => {
		const counts = await Promise.all(tools.flatMap((t) => Object.values(t.syncTables).map((table) => table.count())));
		hasData = counts.some((n) => n > 0);
	});

	function openBackup() {
		unlockFeedback();
		tick();
		backupOpen = true;
	}
</script>

<div class="screen">
	<Wordmark />

	<main>
		<h1 class="display">Install <span class="tag">to use</span></h1>
		<p class="why">
			Safari deletes a website's data after 7 days without a visit. Installed, your data stays put, so the app only
			runs installed.
		</p>

		{#if install.platform === 'mac' && !install.macCanInstall}
			<p class="why">This version of Safari can't install apps. Update macOS to get Safari 17 or newer, or open this page in Chrome or Firefox.</p>
		{:else if install.platform === 'mac'}
			<ol>
				<li>In the menu bar, choose <b>File</b> → <b>Add to Dock</b>.</li>
				<li>Click <b>Add</b>.</li>
				<li>Open <b>Tools</b> from your Dock from now on.</li>
			</ol>
		{:else}
			<ol>
				<li>Tap the <b>Share</b> button (the square with an arrow).</li>
				<li>Scroll down and tap <b>Add to Home Screen</b>.</li>
				<li>Tap <b>Add</b>, then open <b>Tools</b> from your home screen.</li>
			</ol>
			<p class="label">Opened from another app? Open this page in Safari first.</p>
		{/if}
	</main>

	{#if hasData}
		<div class="actions">
			<p class="label">You have data saved in this browser. The app can't see it, so back it up here and restore it in the app.</p>
			<button type="button" class="row" onclick={openBackup}>
				<span class="display">Backup</span><span class="circle" aria-hidden="true">→</span>
			</button>
		</div>
	{/if}
</div>

{#if backupOpen}
	<BackupPanel onclose={() => (backupOpen = false)} />
{/if}

<style>
	.screen {
		min-height: 100dvh;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		padding: calc(18px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
		max-width: 620px;
		margin: 0 auto;
	}
	main {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 18px;
		padding: 24px 0;
	}
	h1 {
		margin: 0;
		font-size: calc(4.2rem / var(--font-wide));
	}
	.why {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.35;
	}
	ol {
		margin: 0;
		padding-left: 1.2em;
		display: grid;
		gap: 10px;
		font-size: 1.15rem;
		line-height: 1.35;
	}
	.label {
		margin: 0;
	}
	.actions {
		display: grid;
		gap: 10px;
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
</style>
