<script lang="ts">
	/**
	 * The Persona page curtain, mounted once in the root layout.
	 *
	 * cover:   three slanted bands slam across, 60ms apart, each overshooting
	 *          and led by a thin accent edge; then, entering a tool, a title
	 *          card stamps the tool's name.
	 * covered: the same, held still while the page swaps underneath.
	 * reveal:  the cover cracks along a jagged accent line and the halves
	 *          fly apart. Going back is the same picture mirrored.
	 *
	 * No flashing: the bands are the page's own background (or within a few
	 * percent of it), so the screen's brightness never jumps; bright accent
	 * only ever covers thin edges, the name bar and the crack. Colours are
	 * read live, so the crack-open already wears the new page's theme.
	 */
	import { curtain } from './state.svelte';

	const p = $derived(curtain.plan);
</script>

{#if curtain.phase !== 'idle' && p}
	<div
		class="curtain {curtain.phase} {p.dir}"
		aria-hidden="true"
		style:--delay="{p.bandsDelay}ms"
		style:--card-at="{p.cardAt}ms"
		style:--reveal="{p.revealMs}ms"
	>
		{#if curtain.phase === 'reveal'}
			<div class="shard left"></div>
			<div class="shard right"></div>
			<div class="crack"></div>
		{:else}
			<div class="band b1"></div>
			<div class="band b2"></div>
			<div class="band b3"></div>
			{#if p.card}
				<div class="titlecard">
					<span class="num display">{p.card.number}</span>
					<div class="bar"><span class="name display">{p.card.title}</span></div>
					{#if p.card.line}<span class="line">{p.card.line}</span>{/if}
					<div class="dots"></div>
				</div>
			{/if}
		{/if}
	</div>
{/if}

<style>
	.curtain {
		position: fixed;
		inset: 0;
		z-index: 1000;
		overflow: hidden;
		/* Swallow taps while it plays: nothing underneath is ready. */
		pointer-events: auto;
	}
	/* Back mirrors the whole picture (there's no text in it going back). */
	.curtain.back {
		transform: scaleX(-1);
	}

	.band {
		position: absolute;
		top: 0;
		bottom: 0;
		/* Wide enough that the skew never uncovers a corner, even on a tall phone. */
		left: -60%;
		width: 220%;
		transform: skewX(-18deg);
		/* The leading (right) edge is the only bright part: a thin accent slash. */
		border-right: 6px solid var(--accent);
	}
	/* Within a few percent of the page colour: motion without a brightness jump. */
	.b1 {
		background: color-mix(in srgb, var(--ink) 9%, var(--bg));
	}
	.b2 {
		background: color-mix(in srgb, var(--ink) 4%, var(--bg));
	}
	.b3 {
		background: var(--bg);
	}
	.cover .band {
		/* The y > 1 control point is the overshoot-and-snap-back. */
		animation: slam 140ms cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
	}
	.cover .b1 {
		animation-delay: var(--delay);
	}
	.cover .b2 {
		animation-delay: calc(var(--delay) + 60ms);
	}
	.cover .b3 {
		animation-delay: calc(var(--delay) + 120ms);
	}
	/* Once it has landed, the last band's slash is past the right edge. */
	@keyframes slam {
		from {
			transform: translateX(-140%) skewX(-18deg);
		}
		to {
			transform: translateX(0) skewX(-18deg);
		}
	}

	.titlecard {
		position: absolute;
		inset: 0;
		opacity: 0;
		color: var(--ink);
	}
	.cover .titlecard {
		animation: stamp 160ms ease-out var(--card-at) both;
	}
	.covered .titlecard {
		opacity: 1;
	}
	/* Fades in fast (not a hard cut) with a 2px jolt. */
	@keyframes stamp {
		0% {
			opacity: 0;
			transform: translate(3px, -3px);
		}
		40% {
			opacity: 1;
			transform: translate(-2px, 1px);
		}
		100% {
			opacity: 1;
			transform: none;
		}
	}
	.num {
		position: absolute;
		right: 4%;
		top: 12%;
		font-size: calc(14rem / var(--font-wide));
		color: var(--faint);
	}
	/* The accent only sits behind the name, like the .tag highlight. */
	.bar {
		position: absolute;
		left: 16px;
		top: 36%;
		max-width: calc(100% - 32px);
		padding: 0.05em 0.35em;
		background: var(--accent);
		transform: skewX(-18deg);
	}
	.name {
		display: block;
		transform: skewX(18deg);
		color: var(--accent-ink);
		font-size: calc(5.6rem / var(--font-wide));
		white-space: nowrap;
		overflow: hidden;
	}
	.line {
		position: absolute;
		left: 16px;
		top: calc(36% + 7.5rem);
		font-family: var(--font-mono);
		font-style: normal;
		font-weight: 700;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		color: var(--dim);
	}
	/* Halftone corner: a faint dot grid that fades out toward the middle. */
	.dots {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 55%;
		height: 30%;
		background-image: radial-gradient(var(--faint) 32%, transparent 34%);
		background-size: 11px 11px;
		mask-image: linear-gradient(to top left, #000, transparent 75%);
	}

	.shard {
		position: absolute;
		inset: 0;
		background: var(--bg);
		animation: var(--reveal) cubic-bezier(0.7, 0, 0.84, 0) both;
	}
	.shard.left {
		clip-path: polygon(0 0, 62% 0, 50% 42%, 57% 46%, 40% 100%, 0 100%);
		animation-name: split-left;
	}
	.shard.right {
		clip-path: polygon(62% 0, 100% 0, 100% 100%, 40% 100%, 57% 46%, 50% 42%);
		animation-name: split-right;
	}
	@keyframes split-left {
		to {
			transform: translate(-75%, -12%);
		}
	}
	@keyframes split-right {
		to {
			transform: translate(75%, 12%);
		}
	}
	/* The crack itself: a thin accent line along the shards' jagged edge, gone as they part. */
	.crack {
		position: absolute;
		inset: 0;
		background: var(--accent);
		clip-path: polygon(
			calc(62% - 3px) 0,
			calc(62% + 3px) 0,
			calc(50% + 3px) 42%,
			calc(57% + 3px) 46%,
			calc(40% + 3px) 100%,
			calc(40% - 3px) 100%,
			calc(57% - 3px) 46%,
			calc(50% - 3px) 42%
		);
		animation: crack calc(var(--reveal) * 0.45) ease-in both;
	}
	@keyframes crack {
		to {
			opacity: 0;
		}
	}
</style>
