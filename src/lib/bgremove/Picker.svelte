<script lang="ts">
	/** The three models: size, whether it's on this device, remove. Best needs WebGPU. */
	import { MODELS, unusableReason, type Device, type ModelId } from './models';
	import { mb } from './progress';

	let {
		device,
		selected = $bindable(),
		downloaded,
		disabled,
		onremove
	}: { device: Device; selected: ModelId; downloaded: Set<ModelId>; disabled: boolean; onremove: (id: ModelId) => void } = $props();
</script>

<div class="models" role="radiogroup" aria-label="Model">
	{#each MODELS as m (m.id)}
		{@const why = unusableReason(m, device)}
		{@const ok = !why}
		<label class="model" class:on={selected === m.id} class:off={!ok}>
			<input type="radio" name="model" value={m.id} bind:group={selected} disabled={disabled || !ok} />
			<span class="display name">{m.name}</span>
			<span class="label">{why ?? m.note}</span>
			<span class="label">
				{#if downloaded.has(m.id)}
					✓ downloaded · {mb(m.bytes)} ·
					<button type="button" class="link" {disabled} onclick={(e) => (e.preventDefault(), onremove(m.id))}>remove</button>
				{:else}
					{mb(m.bytes)}
				{/if}
			</span>
		</label>
	{/each}
</div>

<style>
	.models {
		display: grid;
		gap: 8px;
	}
	.model {
		position: relative;
		display: grid;
		gap: 2px;
		padding: 10px 12px;
		border: 2px solid var(--faint);
		cursor: pointer;
	}
	.model.on {
		border-color: var(--accent);
	}
	.model.off {
		opacity: 0.45;
		cursor: not-allowed;
	}
	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}
	.model:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.name {
		font-size: calc(1.5rem / var(--font-wide));
	}
	.link {
		background: none;
		border: 0;
		padding: 0;
		color: var(--ink);
		text-decoration: underline;
		font: inherit;
		cursor: pointer;
	}
</style>
