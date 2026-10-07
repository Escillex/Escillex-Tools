<script lang="ts">
	/**
	 * Every saved cutout. Oldest → newest by default (scrolled to the newest),
	 * flip to newest first. Numbers: 1 = newest. Touch: tap jumps to it on
	 * the dial, hold + swipe acts. Mouse: click pins the buttons, double-click
	 * downloads, Ctrl+Shift+click deletes without asking.
	 */
	import { tick as settle } from 'svelte';
	import Thumb from './Thumb.svelte';
	import { holdable } from './hold';
	import { swipeAction } from './gesture';
	import { expiryLabel, type Cutout } from './history';

	let {
		items,
		urls,
		now,
		newestFirst = $bindable(),
		pinned = $bindable(),
		onpick,
		ondownload,
		ondelete
	}: {
		items: Cutout[];
		urls: Map<string, string>;
		now: number;
		newestFirst: boolean;
		pinned: string | null;
		onpick: (id: string) => void;
		ondownload: (id: string) => void;
		ondelete: (id: string, instant: boolean) => void;
	} = $props();

	const ordered = $derived(newestFirst ? [...items].reverse() : items);
	let held = $state<string | null>(null);
	let dy = $state(0);
	let box: HTMLDivElement;

	// Newest in view: the bottom when oldest-first, the top when flipped.
	$effect(() => {
		void newestFirst;
		settle().then(() => box?.scrollTo({ top: newestFirst ? 0 : box.scrollHeight }));
	});

	// Clicks don't say whether they came from a mouse or a finger; the pointerdown before them does.
	let lastPointer = 'mouse';

	function onclick(e: MouseEvent, id: string) {
		if (e.ctrlKey && e.shiftKey) return ondelete(id, true);
		if (lastPointer === 'mouse') pinned = pinned === id ? null : id;
		else onpick(id);
	}
</script>

<div class="bar">
	<span class="label">{items.length} saved · 1 = newest</span>
	<button type="button" class="btn small" onclick={() => (newestFirst = !newestFirst)}>{newestFirst ? 'Newest first' : 'Oldest first'} ⇅</button>
</div>
<div class="grid" bind:this={box}>
	{#each ordered as c (c.id)}
		{@const rank = items.length - items.indexOf(c)}
		<div
			class="cell"
			role="button"
			tabindex="0"
			onpointerdown={(e) => (lastPointer = e.pointerType)}
			onclick={(e) => onclick(e, c.id)}
			ondblclick={() => ondownload(c.id)}
			onkeydown={(e) => e.key === 'Enter' && onpick(c.id)}
			use:holdable={{
				onhold: () => ((held = c.id), (dy = 0), (pinned = null)),
				onmove: (d) => (dy = d),
				onend: (d) => {
					held = null;
					const a = swipeAction(d);
					if (a === 'download') ondownload(c.id);
					else if (a === 'delete') ondelete(c.id, false);
				}
			}}
		>
			<Thumb
				src={urls.get(c.id) ?? ''}
				badge={expiryLabel(c, now)}
				number={rank}
				pinned={pinned === c.id}
				held={held === c.id}
				{dy}
				ondownload={() => ondownload(c.id)}
				ondelete={(e) => (e.stopPropagation(), ondelete(c.id, e.ctrlKey && e.shiftKey))}
			/>
		</div>
	{/each}
</div>

<style>
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
		gap: 30px 8px;
		max-height: 70dvh;
		overflow-y: auto;
		padding: 26px 2px;
	}
	.cell {
		display: grid;
		place-items: center;
		outline-offset: 2px;
		-webkit-touch-callout: none;
	}
	.small {
		font-size: 0.95rem;
		padding: 6px 14px;
	}
</style>
