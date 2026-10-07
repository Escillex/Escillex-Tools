<script lang="ts">
	/** The cutout on a checkerboard (so transparency shows), with a before/after toggle. */
	let { before, after, ondownload }: { before: string; after: string; ondownload: () => void } = $props();
	let showBefore = $state(false);
</script>

<figure class="stage" class:checker={!showBefore}>
	<img src={showBefore ? before : after} alt={showBefore ? 'Original photo' : 'Photo with the background removed'} />
</figure>
<div class="row">
	<button type="button" class="btn" aria-pressed={showBefore} onclick={() => (showBefore = !showBefore)}>{showBefore ? 'After' : 'Before'}</button>
	<button type="button" class="btn btn-primary" onclick={ondownload}>Download PNG</button>
</div>

<style>
	.stage {
		margin: 0;
		display: grid;
		place-items: center;
		max-height: 60dvh;
		border: 2px solid var(--line);
	}
	.checker {
		background: repeating-conic-gradient(#bbb 0 25%, #fff 0 50%) 0 0 / 20px 20px;
	}
	img {
		max-width: 100%;
		max-height: 60dvh;
		object-fit: contain;
		display: block;
	}
	.row {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
</style>
