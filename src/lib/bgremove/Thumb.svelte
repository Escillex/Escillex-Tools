<script lang="ts">
	/**
	 * One history thumbnail. Mouse: hover (or pinned) shows ✕ and ↓.
	 * Touch: while held, hints show what swiping up/down will do.
	 */
	import { SWIPE_PX, swipeAction } from './gesture';

	let {
		src,
		badge,
		number,
		pinned,
		held = false,
		dy = 0,
		ondownload,
		ondelete
	}: {
		src: string;
		badge: string | null;
		number?: number;
		pinned: boolean;
		held?: boolean;
		dy?: number;
		ondownload: () => void;
		ondelete: (e: MouseEvent) => void;
	} = $props();

	const action = $derived(held ? swipeAction(dy) : null);
</script>

<div class="thumb" class:pinned class:held style:--dy="{held ? Math.max(-SWIPE_PX, Math.min(SWIPE_PX, dy)) : 0}px">
	<img {src} alt="" draggable="false" />
	{#if number !== undefined}<span class="num">{number}</span>{/if}
	{#if badge}<span class="badge">{badge}</span>{/if}
	<div class="actions" data-loop-ignore>
		<button type="button" class="act" aria-label="Delete" onclick={ondelete}>✕</button>
		<button type="button" class="act" aria-label="Download" onclick={ondownload}>↓</button>
	</div>
	{#if held}
		<span class="hint up" class:hot={action === 'delete'}>↑ Delete</span>
		<span class="hint down" class:hot={action === 'download'}>↓ Download</span>
	{/if}
</div>

<style>
	.thumb {
		position: relative;
		width: 120px;
		height: 120px;
		border: 2px solid var(--line);
		background: repeating-conic-gradient(#bbb 0 25%, #fff 0 50%) 0 0 / 12px 12px;
		-webkit-touch-callout: none;
		user-select: none;
		line-height: normal;
		font-style: normal;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	.held img {
		transform: translateY(var(--dy));
	}
	.num {
		position: absolute;
		top: 0;
		left: 0;
		padding: 0 5px;
		background: var(--ink);
		color: var(--bg);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
	.badge {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--danger);
		color: #fff;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		text-align: center;
	}
	.actions {
		position: absolute;
		top: 4px;
		right: 4px;
		display: flex;
		gap: 4px;
		opacity: 0;
		pointer-events: none;
	}
	@media (hover: hover) {
		.thumb:hover .actions {
			opacity: 1;
			pointer-events: auto;
		}
	}
	.pinned .actions {
		opacity: 1;
		pointer-events: auto;
	}
	.act {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		background: var(--bg);
		color: var(--ink);
		border: 2px solid var(--line);
		font: 700 0.9rem var(--font-mono);
		cursor: pointer;
	}
	.hint {
		position: absolute;
		left: 50%;
		translate: -50% 0;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		padding: 1px 6px;
		background: var(--bg);
		color: var(--ink);
		border: 1px solid var(--line);
	}
	.hint.up {
		top: -24px;
	}
	.hint.down {
		bottom: -24px;
	}
	.hint.down.hot {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.hint.up.hot {
		background: var(--danger);
		color: #fff;
	}
</style>
