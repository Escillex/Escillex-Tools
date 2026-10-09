<script lang="ts">
	/** Fidget settings: the centred toy's preset, then Fidget's own look over the global one. */
	import Sheet from '#lib/ui/Sheet.svelte';
	import ToolLookFields from '#lib/core/ToolLookFields.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { DETENTS, GRIDS, NOTCHES, SWITCH_COUNTS, TOY_LABELS, nextSwitch, type GridSize, type ToyId, type ToyPrefs } from './toys';

	let { toy, prefs, onchange, onclose }: { toy: ToyId; prefs: ToyPrefs; onchange: (p: ToyPrefs) => void; onclose: () => void } = $props();

	function set(patch: Partial<ToyPrefs>) {
		unlockFeedback();
		tick();
		onchange({ ...prefs, ...patch });
	}
	function cycleKey(i: number) {
		const keys = [...prefs.keys] as ToyPrefs['keys'];
		keys[i] = nextSwitch(keys[i]);
		set({ keys });
	}
	const gridLabel = (g: GridSize) => `${g} ${GRIDS[g][0]}×${GRIDS[g][1]}`;
</script>

{#snippet choices<T>(label: string, options: readonly T[], value: T, text: (o: T) => string, pick: (o: T) => void)}
	<p class="label">{label}</p>
	<div class="choices" role="radiogroup" aria-label={label}>
		{#each options as o (o)}
			<button type="button" role="radio" aria-checked={o === value} class="display" onclick={() => pick(o)}>
				<span class:tag={o === value}>{text(o)}</span>
			</button>
		{/each}
	</div>
{/snippet}

<Sheet title="Fidget" {onclose}>
	<h3 class="display">{TOY_LABELS[toy]}</h3>
	{#if toy === 'bubbles'}
		{@render choices('Sheet size', Object.keys(GRIDS) as GridSize[], prefs.grid, gridLabel, (g) => set({ grid: g }))}
	{:else if toy === 'keys'}
		<p class="label">Tap a key to change its switch</p>
		<div class="choices">
			{#each prefs.keys as k, i (i)}
				<button type="button" class="display" onclick={() => cycleKey(i)}><span class="tag">{k}</span></button>
			{/each}
		</div>
	{:else if toy === 'ratchet'}
		{@render choices('Clicks per turn', DETENTS, prefs.detents, String, (d) => set({ detents: d }))}
	{:else if toy === 'switches'}
		{@render choices('Switches', SWITCH_COUNTS, prefs.switches, String, (n) => set({ switches: n }))}
	{:else if toy === 'pen'}
		<p class="label">Nothing to set on the click pen. It's perfect.</p>
	{:else}
		{@render choices('Notches', NOTCHES, prefs.notches, String, (n) => set({ notches: n }))}
	{/if}
	<p class="label">Changing these starts the toy fresh. Your counts stay.</p>

	<ToolLookFields />
</Sheet>

<style>
	.label {
		margin: 0;
	}
	h3 {
		margin: 0;
		font-size: calc(1.8rem / var(--font-wide));
		border-bottom: 2px solid var(--line);
		padding-bottom: 4px;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.choices button {
		border: 0;
		background: none;
		color: var(--dim);
		font-size: calc(1.5rem / var(--font-wide));
		cursor: pointer;
	}
	.choices button[aria-checked='true'] {
		color: var(--accent-ink);
	}
</style>
