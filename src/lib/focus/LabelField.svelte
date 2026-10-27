<script lang="ts">
	/**
	 * What this block is for: type anything, or pick one of your open
	 * tasks as it suggests them. Typing after picking a task unlinks it.
	 */
	import { suggest, type Task } from './tasks';

	let { label, taskId, tasks, onchange }: { label: string; taskId: string | null; tasks: Task[]; onchange: (label: string, taskId: string | null) => void } = $props();

	let open = $state(false);
	const hits = $derived(suggest(tasks, taskId ? '' : label).filter((t) => t.id !== taskId));

	function pick(t: Task) {
		onchange(t.name, t.id);
		open = false;
	}
</script>

<div class="wrap">
	<input
		class="field"
		placeholder="What's this block for?"
		aria-label="Label"
		value={label}
		oninput={(e) => onchange(e.currentTarget.value, null)}
		onfocus={() => (open = true)}
		onblur={() => setTimeout(() => (open = false), 120)}
		onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
	/>
	{#if taskId}<span class="label linked">Task</span>{/if}
	{#if open && hits.length}
		<ul role="listbox" aria-label="Open tasks">
			{#each hits as t (t.id)}
				<li><button type="button" role="option" aria-selected="false" onmousedown={(e) => e.preventDefault()} onclick={() => pick(t)}>{t.name}</button></li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.wrap {
		position: relative;
	}
	.linked {
		position: absolute;
		right: 2px;
		top: 50%;
		transform: translateY(-50%);
		pointer-events: none;
	}
	ul {
		position: absolute;
		z-index: 5;
		left: 0;
		right: 0;
		top: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
		background: var(--bg);
		border: 2px solid var(--line);
		border-top: 0;
	}
	li button {
		width: 100%;
		text-align: left;
		background: none;
		border: 0;
		color: var(--ink);
		font: inherit;
		font-size: 1.05rem;
		padding: 8px 10px;
		cursor: pointer;
	}
	li button:hover,
	li button:focus-visible {
		background: var(--faint);
	}
</style>
