<script lang="ts">
	/** One big click-pen plunger: a click going down and another coming up. Both count. */
	import { unlockFeedback } from '#lib/ui/feedback.ts';
	import { play } from './sounds';

	let { onaction }: { onaction: () => void } = $props();

	let down = $state(false);

	function press() {
		unlockFeedback();
		if (down) return;
		down = true;
		play('penDown', true);
		onaction();
	}
	function release() {
		if (!down) return;
		down = false;
		play('penUp');
		onaction();
	}
	const isKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';
</script>

<div class="pen">
	<button
		type="button"
		class="plunger display"
		class:down
		aria-label="Click pen"
		onpointerdown={press}
		onpointerup={release}
		onpointerleave={release}
		onpointercancel={release}
		onkeydown={(e) => isKey(e) && !e.repeat && (e.preventDefault(), press())}
		onkeyup={(e) => isKey(e) && release()}
	>
		<span>Click</span>
	</button>
	<div class="barrel"></div>
</div>

<style>
	.pen {
		display: grid;
		justify-items: center;
		touch-action: manipulation;
	}
	.plunger {
		width: 8rem;
		height: 7rem;
		border: 2px solid var(--line);
		border-bottom: 0;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: calc(1.6rem / var(--font-wide));
		cursor: pointer;
		transition: transform 40ms;
	}
	.down {
		transform: translateY(2.2rem);
	}
	.barrel {
		width: 11rem;
		height: 9rem;
		border: 2px solid var(--line);
		background: var(--bg);
		position: relative;
		z-index: 1;
	}
</style>
