<script lang="ts">
	/**
	 * An odometer: each digit is a strip of 0-9 that slides to the right
	 * number. Digits are keyed by their position from the right, so the
	 * ones digit stays the ones digit and rolls instead of being replaced.
	 */
	let { value, fast = false }: { value: number; fast?: boolean } = $props();

	const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

	const text = $derived(Math.abs(Math.trunc(value)).toLocaleString('en-PH'));
	const chars = $derived([...text]);
	const negative = $derived(value < 0);
</script>

<span class="number" class:fast role="img" aria-label={(negative ? 'minus ' : '') + text}>
	{#if negative}<span class="sep">−</span>{/if}
	{#each chars as ch, i (chars.length - i)}
		{#if ch >= '0' && ch <= '9'}
			<span class="digit">
				<span class="strip" style:transform="translateY({-Number(ch)}em)">
					{#each DIGITS as d (d)}<span>{d}</span>{/each}
				</span>
			</span>
		{:else}
			<span class="sep">{ch}</span>
		{/if}
	{/each}
</span>

<style>
	.number {
		display: inline-flex;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.digit {
		display: inline-block;
		height: 1em;
		overflow: hidden;
	}
	.strip {
		display: flex;
		flex-direction: column;
		transition: transform 520ms cubic-bezier(0.2, 0.9, 0.25, 1);
	}
	/* While dragging, numbers change quickly; a shorter roll keeps up. */
	.fast .strip {
		transition-duration: 160ms;
	}
	.strip span {
		height: 1em;
	}
	@media (prefers-reduced-motion: reduce) {
		.strip {
			transition: none;
		}
	}
</style>
