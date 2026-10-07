<script lang="ts">
	/** History settings and the delete-prompt switches. */
	import { untrack } from 'svelte';
	import Sheet from '#lib/ui/Sheet.svelte';
	import { MAX_KEEP, clampKeep } from './history';
	import { SKIP_MS, skipActive, type Prefs } from './prefs';
	import { mb } from './progress';

	let {
		prefs,
		count,
		totalBytes,
		onchange,
		onclear,
		onclose
	}: {
		prefs: Prefs;
		count: number;
		totalBytes: number;
		onchange: <K extends keyof Prefs>(k: K, v: Prefs[K]) => void;
		onclear: () => void;
		onclose: () => void;
	} = $props();

	// The box is edited freely; the saved value only changes on commit (and may be refused).
	let keepInput = $state(untrack(() => prefs.keep));

	function setKeep() {
		const next = clampKeep(keepInput);
		if (next < count && !confirm(`This deletes the ${count - next === 1 ? 'oldest cutout' : `${count - next} oldest cutouts`}.`)) {
			keepInput = prefs.keep;
			return;
		}
		keepInput = next;
		onchange('keep', next);
	}

	function setNeverAsk(e: Event) {
		const box = e.currentTarget as HTMLInputElement;
		if (box.checked && !(confirm('Are you sure?') && confirm("Are you really, really sure? We aren't liable if you lose data."))) {
			box.checked = false;
			return;
		}
		onchange('neverAsk', box.checked);
	}
</script>

<Sheet title="BG Remove" {onclose}>
	<label class="check">
		<input type="checkbox" checked={prefs.autosave} onchange={(e) => onchange('autosave', e.currentTarget.checked)} />
		Save cutouts to history
	</label>
	{#if prefs.autosave}
		<label class="stack">
			<span class="label">Keep (1–{MAX_KEEP})</span>
			<input class="field" type="number" min="1" max={MAX_KEEP} bind:value={keepInput} onchange={setKeep} />
		</label>
		<p class="label">Cutouts are deleted after 7 days. History: {count} · {mb(totalBytes)}</p>
		<button type="button" class="btn btn-danger" disabled={!count} onclick={onclear}>Clear all</button>
	{/if}
	<label class="check">
		<input
			type="checkbox"
			checked={skipActive(prefs.skipUntil, Date.now())}
			onchange={(e) => onchange('skipUntil', e.currentTarget.checked ? Date.now() + SKIP_MS : null)}
		/>
		Don't ask before deleting (turns itself off after 12 hours)
	</label>
	<label class="check"><input type="checkbox" checked={prefs.neverAsk} onchange={setNeverAsk} /> Never ask before deleting</label>
</Sheet>

<style>
	.check {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.stack {
		display: grid;
		gap: 4px;
	}
	p {
		margin: 0;
	}
</style>
