<script lang="ts">
	/**
	 * Pick a color: tap a preset swatch, open the device's color wheel (the
	 * rainbow swatch), or type a hex code. Optionally offers one "special"
	 * choice first: 'auto' (text that adapts to the background) or
	 * 'default' (a wallet using the app's color).
	 */
	import { tick, unlockFeedback } from './feedback';
	import { normalizeHex } from './color';

	let {
		label,
		value,
		swatches,
		special = null,
		onchange
	}: {
		label: string;
		/** A "#rrggbb" color, or the special value ('auto' / 'default'). */
		value: string;
		swatches: string[];
		special?: { value: 'auto' | 'default'; label: string; shows: string } | null;
		onchange: (value: string) => void;
	} = $props();

	let hexText = $state('');
	let hexError = $state(false);
	$effect(() => {
		hexText = value.startsWith('#') ? value : '';
		hexError = false;
	});

	function choose(v: string) {
		unlockFeedback();
		if (v !== value) tick();
		onchange(v);
	}

	function onHex(e: Event & { currentTarget: HTMLInputElement }) {
		hexText = e.currentTarget.value;
		const hex = normalizeHex(hexText);
		hexError = hexText.trim() !== '' && !hex;
		if (hex && hex !== value) onchange(hex);
	}

	const isCustom = $derived(value.startsWith('#') && !swatches.includes(value));
	/** What's actually shown, for the preview chip. */
	const shown = $derived(special && value === special.value ? special.shows : value);
</script>

<div class="field-group">
	<div class="head">
		<span class="label">{label}</span>
		<span class="chip" style:background={shown} aria-hidden="true"></span>
	</div>
	<div class="swatches" role="radiogroup" aria-label={label}>
		{#if special}
			<button type="button" role="radio" aria-checked={value === special.value} class="sw special" onclick={() => choose(special.value)} style:--c={special.shows}>
				{special.label}
			</button>
		{/if}
		{#each swatches as c (c)}
			<button type="button" role="radio" aria-checked={value === c} aria-label={c} class="sw" style:--c={c} onclick={() => choose(c)}></button>
		{/each}
		<!-- The rainbow swatch opens the device's own color picker. -->
		<label class="sw wheel" class:on={isCustom} aria-label="Pick any color">
			<input type="color" value={value.startsWith('#') ? value : shown} oninput={(e) => onchange(e.currentTarget.value)} />
		</label>
	</div>
	<input
		class="field hex"
		class:bad={hexError}
		aria-label="{label} hex code"
		placeholder={special && value === special.value ? special.label : '#rrggbb'}
		value={hexText}
		oninput={onHex}
		spellcheck="false"
		autocomplete="off"
	/>
</div>

<style>
	.field-group {
		display: grid;
		gap: 6px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.chip {
		width: 22px;
		height: 22px;
		border: 2px solid var(--line);
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	/* Slanted color blocks, like the tags. The chosen one is marked with a check. */
	.sw {
		position: relative;
		width: 40px;
		height: 30px;
		padding: 0;
		border: 0;
		background: var(--c);
		clip-path: polygon(16% 0, 100% 0, 84% 100%, 0 100%);
		cursor: pointer;
		box-shadow: inset 0 0 0 2px var(--faint);
	}
	.sw[aria-checked='true']::after,
	.sw.wheel.on::after {
		content: '✓';
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-style: normal;
		font-weight: 700;
		color: #fff;
		mix-blend-mode: difference;
	}
	.sw.special {
		width: auto;
		padding: 0 14px;
		background: var(--faint);
		color: var(--ink);
		font-family: var(--font);
		font-style: var(--font-style);
		font-weight: var(--font-weight);
		text-transform: uppercase;
		font-size: 0.85rem;
	}
	.sw.special[aria-checked='true'] {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.sw.special[aria-checked='true']::after {
		content: none;
	}
	.wheel {
		background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
	}
	.wheel input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
	}
	.hex {
		font-family: ui-monospace, Consolas, monospace;
		font-style: normal;
		font-size: calc(1rem / var(--font-wide));
		max-width: 140px;
		text-transform: lowercase;
	}
	.hex.bad {
		border-bottom-color: var(--danger);
	}
</style>
