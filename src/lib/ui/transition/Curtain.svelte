<script lang="ts">
	/**
	 * The Persona page curtain, mounted once in the root layout.
	 *
	 * cover:   three slanted bands (ink, accent, bg) slam across, 40ms apart,
	 *          each overshooting; then, entering a tool, a title card stamps.
	 * covered: the same, held still while the page swaps underneath.
	 * reveal:  the cover cracks along a jagged line and the halves fly apart.
	 * Going back is the same picture mirrored. Colours are read live, so
	 * the crack-open already wears the new page's theme.
	 */
	import { curtain } from './state.svelte';

	const p = $derived(curtain.plan);
</script>

{#if curtain.phase !== 'idle' && p}
	<div
		class="curtain {curtain.phase} {p.dir}"
		class:card={!!p.card}
		aria-hidden="true"
		style:--delay="{p.bandsDelay}ms"
		style:--card-at="{p.cardAt}ms"
		style:--reveal="{p.revealMs}ms"
	>
		{#if curtain.phase === 'reveal'}
			<div class="shard left"></div>
			<div class="shard right"></div>
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
	}
	.b1 {
		background: var(--ink);
	}
	.b2 {
		background: var(--accent);
	}
	.b3 {
		background: var(--bg);
	}
	/* Entering a tool, the last band is the accent the title card sits on. */
	.card .b3 {
		background: var(--accent);
	}
	.cover .band {
		/* The y > 1 control point is the overshoot-and-snap-back. */
		animation: slam 110ms cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
	}
	.cover .b1 {
		animation-delay: var(--delay);
	}
	.cover .b2 {
		animation-delay: calc(var(--delay) + 40ms);
	}
	.cover .b3 {
		animation-delay: calc(var(--delay) + 80ms);
	}
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
		color: var(--accent-ink);
	}
	.cover .titlecard {
		animation: stamp 120ms linear var(--card-at) both;
	}
	.covered .titlecard {
		opacity: 1;
	}
	/* Appears at once, with a 2px jolt. */
	@keyframes stamp {
		0% {
			opacity: 1;
			transform: translate(2px, -2px);
		}
		40% {
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
		color: color-mix(in srgb, var(--accent-ink) 22%, var(--accent));
	}
	.bar {
		position: absolute;
		left: -10%;
		right: -10%;
		top: 36%;
		padding: 0.1em 14%;
		background: var(--bg);
		transform: skewX(-18deg);
	}
	.name {
		display: block;
		transform: skewX(18deg);
		color: var(--ink);
		font-size: calc(7rem / var(--font-wide));
		white-space: nowrap;
		overflow: hidden;
	}
	.line {
		position: absolute;
		left: 16px;
		top: calc(36% + 9.5rem);
		font-family: var(--font-mono);
		font-style: normal;
		font-weight: 700;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
	}
	/* Halftone corner: a dot grid that fades out toward the middle. */
	.dots {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 55%;
		height: 30%;
		background-image: radial-gradient(color-mix(in srgb, var(--accent-ink) 25%, var(--accent)) 32%, transparent 34%);
		background-size: 11px 11px;
		mask-image: linear-gradient(to top left, #000, transparent 75%);
	}

	.shard {
		position: absolute;
		inset: 0;
		background: var(--bg);
		animation: var(--reveal) cubic-bezier(0.7, 0, 0.84, 0) both;
	}
	.card .shard {
		background: var(--accent);
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
</style>
