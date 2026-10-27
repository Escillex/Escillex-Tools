<script lang="ts">
	/** The focus log: every block, grouped by the day it started. Today is open; older days fold away. */
	import { onMount } from 'svelte';
	import { tick } from '#lib/ui/feedback.ts';
	import { dayKey, formatMinutes, groupByDay, type LogRow } from '#lib/focus/log.ts';
	import { loadAll, tombstone } from '#lib/focus/db.ts';
	import type { Task } from '#lib/focus/tasks.ts';

	let log = $state<LogRow[]>([]);
	let tasks = $state<Task[]>([]);
	let ready = $state(false);
	let open = $state<Record<string, boolean>>({});

	const days = $derived(groupByDay(log));
	const today = dayKey(Date.now());

	onMount(() => {
		loadAll().then((data) => {
			log = data.log.filter((r) => !r.deleted);
			tasks = data.tasks;
			ready = true;
		});
	});

	const dayName = (key: string) => {
		const [y, m, d] = key.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
	};
	const time = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	// A task's current name (it may have been renamed); the stored label otherwise.
	const what = (r: LogRow) => tasks.find((t) => t.id === r.taskId && !t.deleted)?.name ?? (r.label || '—');

	async function remove(r: LogRow) {
		tick();
		log = log.filter((x) => x.id !== r.id);
		await tombstone('log', [r.id], Date.now());
	}
</script>

<svelte:head><title>FOCUS · LOG</title></svelte:head>

<main class="screen">
	<header class="top">
		<a class="circle" href="/focus" aria-label="Back to the timer">←</a>
		<h1 class="display">Log</h1>
	</header>

	{#if ready && !days.length}
		<p class="label">No focus blocks yet.</p>
	{/if}

	{#each days as d (d.key)}
		{@const isOpen = open[d.key] ?? d.key === today}
		<section>
			<button type="button" class="day display" aria-expanded={isOpen} onclick={() => (open[d.key] = !isOpen)}>
				<span>{d.key === today ? 'Today' : dayName(d.key)}</span>
				<span class="sum">{d.pomodoros} 🍅 · {formatMinutes(d.minutes)}</span>
			</button>
			{#if isOpen}
				{#each d.rows as r (r.id)}
					<div class="row">
						<span class="label">{time(r.start)}</span>
						<span class="what">{what(r)}</span>
						<span class="label">{r.minutes}m {r.completed ? '✓' : 'stopped'}</span>
						<button type="button" class="x" aria-label="Delete this block" onclick={() => remove(r)}>✕</button>
					</div>
				{/each}
			{/if}
		</section>
	{/each}
</main>

<style>
	.screen {
		box-sizing: border-box;
		min-height: 100dvh;
		max-width: 620px;
		margin: 0 auto;
		display: grid;
		gap: 12px;
		align-content: start;
		padding: calc(14px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	h1 {
		margin: 0;
		font-size: calc(2.2rem / var(--font-wide));
	}
	.day {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		background: none;
		border: 0;
		border-bottom: 2px solid var(--line);
		color: var(--ink);
		font-size: calc(1.5rem / var(--font-wide));
		padding: 6px 0;
		cursor: pointer;
	}
	.sum {
		color: var(--dim);
		font-size: 0.8em;
	}
	.row {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px solid var(--faint);
	}
	.what {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.x {
		background: none;
		border: 0;
		color: var(--dim);
		cursor: pointer;
		padding: 4px;
	}
</style>
