<script lang="ts">
	/** "Delete this cutout?" with the 12-hour don't-ask option. */
	import Sheet from '#lib/ui/Sheet.svelte';

	let { onconfirm, oncancel }: { onconfirm: (skip12h: boolean) => void; oncancel: () => void } = $props();
	let skip = $state(false);
</script>

<Sheet title="Delete?" onclose={oncancel}>
	<p>This cutout will be gone from this device.</p>
	<label class="check"><input type="checkbox" bind:checked={skip} /> Don't ask again for 12 hours</label>
	<div class="row">
		<button type="button" class="btn" onclick={oncancel}>Cancel</button>
		<button type="button" class="btn btn-danger" onclick={() => onconfirm(skip)}>Delete</button>
	</div>
</Sheet>

<style>
	p {
		margin: 0;
	}
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.row {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}
</style>
