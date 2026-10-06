<script module lang="ts">
	export type Mode = 'read' | 'write' | 'raw' | 'split';

	/** A saved mode from settings; 'edit' was Raw's old name. */
	export function toMode(v: unknown): Mode | null {
		if (v === 'edit') return 'raw';
		return v === 'read' || v === 'write' || v === 'raw' || v === 'split' ? v : null;
	}

	/** Split needs room for two columns. */
	export function wideScreen() {
		const q = matchMedia('(min-width: 900px)');
		let current = $state(q.matches);
		$effect(() => {
			const on = () => (current = q.matches);
			q.addEventListener('change', on);
			return () => q.removeEventListener('change', on);
		});
		return {
			get current() {
				return current;
			}
		};
	}
</script>

<script lang="ts">
	/** Read / Write / Raw / Split, styled like ModeSwitch: the active one gets the slanted tag. */
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';

	let { mode = $bindable('read'), wide }: { mode?: Mode; wide: boolean } = $props();

	const options = $derived<Mode[]>(wide ? ['read', 'write', 'raw', 'split'] : ['read', 'write', 'raw']);
	const shown = $derived<Mode>(mode === 'split' && !wide ? 'raw' : mode);

	function set(m: Mode) {
		unlockFeedback();
		if (m !== shown) tick();
		mode = m;
	}
</script>

<div class="tabs" role="radiogroup" aria-label="View">
	{#each options as m (m)}
		<button type="button" role="radio" aria-checked={shown === m} class="display" onclick={() => set(m)}>
			<span class:tag={shown === m}>{m}</span>
		</button>
	{/each}
</div>

<style>
	.tabs {
		display: flex;
		gap: 2px;
	}
	button {
		border: 0;
		background: none;
		color: var(--dim);
		font-size: calc(1.25rem / var(--font-wide));
		padding: 4px 4px;
		cursor: pointer;
	}
	button[aria-checked='true'] {
		color: var(--accent-ink);
	}
</style>
