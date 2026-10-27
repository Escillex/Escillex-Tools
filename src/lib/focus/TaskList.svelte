<script lang="ts">
	/**
	 * The optional task list: just a "+ Task" button until you add one.
	 * Each task shows pomodoros against its estimate; done ones fold away
	 * under "Done" with a Clear button.
	 */
	import { progress, splitTasks, type Task } from './tasks';

	let {
		tasks,
		current,
		onadd,
		ontoggle,
		onclear,
		onpick
	}: {
		tasks: Task[];
		/** The task the running block is linked to. */
		current: string | null;
		onadd: (name: string, estimate: number | null) => void;
		ontoggle: (t: Task) => void;
		onclear: () => void;
		onpick: (t: Task) => void;
	} = $props();

	const lists = $derived(splitTasks(tasks));
	let adding = $state(false);
	let name = $state('');
	let estimate = $state(0);
	let showDone = $state(false);

	function add(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim()) return;
		onadd(name, estimate > 0 ? estimate : null);
		name = '';
		estimate = 0;
	}
</script>

<section class="tasks" aria-label="Tasks">
	<header>
		<span class="label">Tasks</span>
		<button type="button" class="circle" aria-label="Add a task" aria-expanded={adding} onclick={() => (adding = !adding)}>{adding ? '−' : '+'}</button>
	</header>

	{#if adding}
		<form onsubmit={add}>
			<input class="field" placeholder="Task name" aria-label="Task name" bind:value={name} />
			<div class="est">
				<button type="button" class="circle" aria-label="Fewer pomodoros" onclick={() => (estimate = Math.max(0, estimate - 1))}>−</button>
				<span class="label">{estimate ? `~${estimate} 🍅` : 'No estimate'}</span>
				<button type="button" class="circle" aria-label="More pomodoros" onclick={() => (estimate = Math.min(20, estimate + 1))}>+</button>
				<button type="submit" class="btn">Add</button>
			</div>
		</form>
	{/if}

	{#each lists.open as t (t.id)}
		{@const p = progress(t)}
		<div class="row" class:current={t.id === current}>
			<button type="button" class="check" role="checkbox" aria-checked="false" aria-label="Mark {t.name} done" onclick={() => ontoggle(t)}></button>
			<button type="button" class="name" onclick={() => onpick(t)}>{t.name}</button>
			<span class="label count" class:over={p.over}>{p.text} 🍅</span>
		</div>
	{/each}

	{#if lists.done.length}
		<div class="done-head">
			<button type="button" class="label toggle" aria-expanded={showDone} onclick={() => (showDone = !showDone)}>{showDone ? '▾' : '▸'} Done ({lists.done.length})</button>
			{#if showDone}<button type="button" class="label toggle" onclick={onclear}>Clear</button>{/if}
		</div>
		{#if showDone}
			{#each lists.done as t (t.id)}
				<div class="row done">
					<button type="button" class="check on" role="checkbox" aria-checked="true" aria-label="Reopen {t.name}" onclick={() => ontoggle(t)}></button>
					<span class="name">{t.name}</span>
					<span class="label count">{progress(t).text} 🍅</span>
				</div>
			{/each}
		{/if}
	{/if}
</section>

<style>
	.tasks {
		display: grid;
		gap: 4px;
		border-top: 2px solid var(--line);
		padding-top: 8px;
	}
	header,
	.done-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	form {
		display: grid;
		gap: 8px;
		padding-bottom: 8px;
	}
	.est {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.est .btn {
		margin-left: auto;
	}
	.row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px solid var(--faint);
	}
	.row.current .name {
		color: var(--accent);
	}
	.check {
		width: 1.1rem;
		height: 1.1rem;
		border: 2px solid var(--line);
		background: none;
		padding: 0;
		cursor: pointer;
	}
	.check.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.name {
		text-align: left;
		background: none;
		border: 0;
		color: var(--ink);
		font: inherit;
		font-size: 1.05rem;
		padding: 0;
		cursor: pointer;
	}
	.done .name {
		color: var(--dim);
		text-decoration: line-through;
		cursor: default;
	}
	.count.over {
		color: var(--danger);
	}
	.toggle {
		background: none;
		border: 0;
		padding: 6px 0;
		cursor: pointer;
	}
</style>
