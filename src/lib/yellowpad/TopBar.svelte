<script lang="ts">
	/** File name (quiet mono label; the document's own # title carries the Persona bar), view switch, save, settings. */
	import type { Snippet } from 'svelte';
	import ModeTabs, { type Mode } from '#lib/markdown/ModeTabs.svelte';

	let {
		name,
		dirty,
		mode = $bindable(),
		wide,
		onsettings,
		onclose,
		save
	}: { name: string; dirty: boolean; mode: Mode; wide: boolean; onsettings: () => void; onclose: () => void; save: Snippet } = $props();
</script>

<header>
	<div class="row">
		<button type="button" class="circle" aria-label="Close file" onclick={onclose}>←</button>
		<p class="label name" title={name}>{dirty ? '• ' : ''}{name}</p>
		<button type="button" class="circle" aria-label="Yellowpad settings" onclick={onsettings}>⚙</button>
	</div>
	<div class="row">
		<ModeTabs bind:mode {wide} />
		{@render save()}
	</div>
</header>

<style>
	header {
		position: sticky;
		top: 0;
		z-index: 8;
		background: var(--bg);
		border-bottom: 2px solid var(--line);
		padding-bottom: 6px;
		margin-bottom: 14px;
		display: grid;
		gap: 6px;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.name {
		flex: 1;
		margin: 0;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
