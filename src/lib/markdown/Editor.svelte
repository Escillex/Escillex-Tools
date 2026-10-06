<script lang="ts">
	/** The raw Markdown, in the mono font, with the formatting toolbar on top. */
	import Toolbar from './Toolbar.svelte';
	import { applyToTextarea, shortcut, type Transform } from './edit';
	import type { Doc } from './doc.svelte';

	let { doc }: { doc: Doc } = $props();

	let area: HTMLTextAreaElement;

	function run(make: Transform) {
		applyToTextarea(area, make);
		doc.text = area.value;
	}

	function onkeydown(e: KeyboardEvent) {
		const make = shortcut(e);
		if (!make) return;
		e.preventDefault();
		run(make);
	}
</script>

<div class="editor">
	<Toolbar {run} sticky />
	<textarea bind:this={area} bind:value={doc.text} {onkeydown} spellcheck="true" aria-label="Markdown"></textarea>
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		min-height: 60dvh;
		position: relative;
	}
	textarea {
		flex: 1;
		min-height: 60dvh;
		resize: none;
		background: transparent;
		color: var(--ink);
		border: 0;
		outline: none;
		padding: 12px 2px;
		font-family: var(--font-mono);
		font-style: normal;
		font-weight: 400;
		font-size: 0.95rem;
		line-height: 1.6;
		tab-size: 4;
	}
	@media (pointer: coarse) {
		textarea {
			padding-bottom: 64px;
		}
	}
</style>
