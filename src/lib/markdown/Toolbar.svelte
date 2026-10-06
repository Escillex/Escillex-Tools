<script lang="ts">
	/**
	 * The formatting buttons. `run` applies a transform to whichever box is
	 * being edited (the raw editor, or a Write-mode block). Buttons never
	 * take focus, so the box keeps its selection.
	 *
	 * On a phone the bar rides just above the keyboard: the visual viewport
	 * shrinks when the keyboard opens, and we follow its bottom.
	 */
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { code, cycleHeading, insertLink, insertTable, prefixLines, wrap } from './transforms';
	import type { Transform } from './edit';

	let { run, sticky = false }: { run: (make: Transform) => void; sticky?: boolean } = $props();

	let picker = $state(false);
	let pick = $state({ rows: 0, cols: 0 });

	function go(make: Transform) {
		unlockFeedback();
		tick();
		run(make);
	}

	let lift = $state(0);
	$effect(() => {
		const vv = window.visualViewport;
		if (!vv || !matchMedia('(pointer: coarse)').matches) return;
		const update = () => (lift = Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		update();
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

	const keep = (e: PointerEvent) => e.preventDefault();
</script>

<div class="bar" class:sticky style:--lift="{lift}px">
	<div class="toolbar" role="toolbar" aria-label="Formatting">
		<button type="button" onpointerdown={keep} onclick={() => go((t, s) => wrap(t, s, '**'))} aria-label="Bold"><b>B</b></button>
		<button type="button" onpointerdown={keep} onclick={() => go((t, s) => wrap(t, s, '*'))} aria-label="Italic"><i>I</i></button>
		<button type="button" onpointerdown={keep} onclick={() => go(cycleHeading)} aria-label="Heading">H</button>
		<button type="button" onpointerdown={keep} onclick={() => go((t, s) => prefixLines(t, s, '- '))} aria-label="List">•</button>
		<button type="button" onpointerdown={keep} onclick={() => go((t, s) => prefixLines(t, s, '- [ ] '))} aria-label="Checklist">☐</button>
		<button type="button" onpointerdown={keep} onclick={() => go(insertLink)} aria-label="Link">↗</button>
		<button type="button" onpointerdown={keep} onclick={() => go(code)} aria-label="Code">{'</>'}</button>
		<button type="button" onpointerdown={keep} onclick={() => (picker = !picker)} aria-label="Table" aria-expanded={picker}>▦</button>
	</div>

	{#if picker}
		<div class="picker" role="group" aria-label="Table size" onpointerleave={() => (pick = { rows: 0, cols: 0 })}>
			{#each { length: 8 } as _, r (r)}
				{#each { length: 8 } as _, c (c)}
					<button
						type="button"
						class:on={r < pick.rows && c < pick.cols}
						aria-label="{r + 1} rows by {c + 1} columns"
						onpointerdown={keep}
						onpointerenter={() => (pick = { rows: r + 1, cols: c + 1 })}
						onclick={() => {
							picker = false;
							go((t, s) => insertTable(t, s, r + 1, c + 1));
						}}
					></button>
				{/each}
			{/each}
			<p class="label">{pick.rows || '–'} × {pick.cols || '–'}</p>
		</div>
	{/if}
</div>

<style>
	.bar {
		position: relative;
		background: var(--bg);
	}
	.bar.sticky {
		position: sticky;
		top: 0;
		z-index: 4;
		border-bottom: 2px solid var(--line);
	}
	@media (pointer: coarse) {
		.bar,
		.bar.sticky {
			position: fixed;
			left: 0;
			right: 0;
			bottom: var(--lift);
			top: auto;
			z-index: 9;
			padding: 0 16px;
			border-top: 2px solid var(--line);
			border-bottom: 0;
		}
	}
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		padding: 6px 0;
	}
	.toolbar button {
		min-width: 2.3rem;
		height: 2.3rem;
		border: 2px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font-mono);
		font-style: normal;
		font-size: 1rem;
		cursor: pointer;
	}
	.toolbar button:active {
		transform: scale(0.94);
	}
	.picker {
		position: absolute;
		top: 3rem;
		right: 0;
		z-index: 6;
		display: grid;
		grid-template-columns: repeat(8, 1.4rem);
		gap: 3px;
		padding: 10px;
		background: var(--bg);
		border: 2px solid var(--line);
	}
	@media (pointer: coarse) {
		.picker {
			top: auto;
			bottom: 3.2rem;
		}
	}
	.picker button {
		width: 1.4rem;
		height: 1.4rem;
		border: 2px solid var(--line);
		background: none;
		padding: 0;
		cursor: pointer;
	}
	.picker button.on {
		background: var(--accent);
		border-color: var(--accent);
	}
	.picker .label {
		grid-column: 1 / -1;
		margin: 4px 0 0;
		text-align: center;
	}
</style>
