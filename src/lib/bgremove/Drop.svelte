<script lang="ts">
	/** Pick or drop one image. (Paste is handled by the page, so it works anywhere on it.) */
	let { onfile }: { onfile: (file: File) => void } = $props();
	let over = $state(false);
	let input: HTMLInputElement;

	function ondrop(e: DragEvent) {
		e.preventDefault();
		over = false;
		const f = e.dataTransfer?.files[0];
		if (f) onfile(f);
	}
</script>

<button
	type="button"
	class="drop"
	class:over
	onclick={() => input.click()}
	ondragover={(e) => (e.preventDefault(), (over = true))}
	ondragleave={() => (over = false)}
	{ondrop}
>
	<span class="display">Pick a photo</span>
	<span class="label">or drop it here · or paste (Ctrl+V)</span>
</button>
<input
	bind:this={input}
	type="file"
	accept="image/*"
	hidden
	onchange={() => {
		const f = input.files?.[0];
		if (f) onfile(f);
		input.value = '';
	}}
/>

<style>
	.drop {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 6px;
		width: 100%;
		min-height: 200px;
		background: none;
		color: var(--ink);
		border: 2px dashed var(--dim);
		cursor: pointer;
	}
	.drop.over {
		border-color: var(--accent);
		border-style: solid;
	}
	.display {
		font-size: calc(2rem / var(--font-wide));
	}
</style>
