<script lang="ts">
	/**
	 * The document in Read, Write (block editing on the rendered view), Raw (the textarea)
	 * or Split (Raw beside Read). The mode switch itself lives in the tool's top bar (ModeTabs).
	 */
	import Viewer from './Viewer.svelte';
	import Editor from './Editor.svelte';
	import { wideScreen, type Mode } from './ModeTabs.svelte';
	import type { Doc } from './doc.svelte';

	let { doc, mode }: { doc: Doc; mode: Mode } = $props();

	const wide = wideScreen();
	const shown = $derived<Mode>(mode === 'split' && !wide.current ? 'raw' : mode);

	// Read and Write have no page-wide textarea, so undo for cells, checkboxes and blocks is ours.
	function onkeydown(e: KeyboardEvent) {
		if ((shown !== 'read' && shown !== 'write') || !(e.ctrlKey || e.metaKey)) return;
		const el = e.target as HTMLElement;
		if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return;
		const k = e.key.toLowerCase();
		if (k === 'z' && !e.shiftKey) doc.undo();
		else if ((k === 'z' && e.shiftKey) || k === 'y') doc.redo();
		else return;
		e.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

<div class="view" class:split={shown === 'split'}>
	{#if shown === 'raw' || shown === 'split'}
		<Editor {doc} />
	{/if}
	{#if shown !== 'raw'}
		<Viewer {doc} write={shown === 'write'} />
	{/if}
</div>

<style>
	.view.split {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 24px;
		align-items: start;
	}
	.view.split > :global(:last-child) {
		border-left: 2px solid var(--line);
		padding-left: 24px;
	}
</style>
