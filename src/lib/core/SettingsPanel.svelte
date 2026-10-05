<script lang="ts">
	/**
	 * App-wide settings: currency, colors (background, text, accent) and
	 * display font. Changes apply instantly (the whole app updates behind
	 * the panel) and are saved on this device. Wallets can override the
	 * colors for themselves in Wallet → Manage.
	 */
	import Sheet from '#lib/ui/Sheet.svelte';
	import ColorField from '#lib/ui/ColorField.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { contrast, textOn } from '#lib/ui/color.ts';
	import { FONTS, SWATCHES, appPalette, theme, type FontId } from './theme.svelte';
	import { CURRENCIES, currencyName, formatMoney, money, setCurrency, type Currency } from './currency.svelte';

	let { onclose }: { onclose: () => void } = $props();

	function pickFont(id: FontId) {
		unlockFeedback();
		if (id !== theme.font) tick();
		theme.set({ font: id });
	}

	/** Below 3:1 big text starts getting hard to read. */
	const readable = $derived.by(() => {
		const p = appPalette();
		return contrast(p.ink, p.bg) >= 3;
	});
	let armedReset = $state(false);
</script>

<Sheet title="Settings" {onclose}>
	<p class="label">Currency</p>
	<select class="field" value={money.currency} onchange={(e) => (tick(), setCurrency(e.currentTarget.value as Currency))}>
		{#each CURRENCIES as code (code)}
			<option value={code}>{code} · {currencyName(code)}</option>
		{/each}
	</select>
	<p class="label">Shows as {formatMoney(123456)}. Only changes how amounts look, not the numbers.</p>

	<h3 class="display">Colors</h3>
	<ColorField label="Background" value={theme.bg} swatches={SWATCHES.bg} onchange={(v) => theme.set({ bg: v })} />
	<ColorField
		label="Text"
		value={theme.ink}
		swatches={SWATCHES.ink}
		special={{ value: 'auto', label: 'Auto', shows: textOn(theme.bg) }}
		onchange={(v) => theme.set({ ink: v })}
	/>
	<ColorField label="Accent" value={theme.accent} swatches={SWATCHES.accent} onchange={(v) => theme.set({ accent: v })} />
	{#if !readable}
		<p class="warn">The text is hard to read on this background. Try Auto text, or a lighter/darker background.</p>
	{/if}

	<h3 class="display">Font</h3>
	<div class="fonts" role="radiogroup" aria-label="Font">
		{#each Object.entries(FONTS) as [id, f] (id)}
			<button
				type="button"
				role="radio"
				aria-checked={theme.font === id}
				class="font"
				style:font-family={f.family}
				style:font-weight={f.weight}
				style:font-style={f.style}
				onclick={() => pickFont(id as FontId)}
			>
				<span class:tag={theme.font === id}>{f.name} 1,234</span>
			</button>
		{/each}
	</div>

	<p class="label">Preview</p>
	<div class="preview">
		<span class="display"><span class="tag">Cash</span></span>
		<span class="display big">272</span>
		<span class="label">Day 3 of 14</span>
	</div>

	<button
		class="btn"
		class:btn-danger={armedReset}
		type="button"
		onclick={() => {
			if (!armedReset) return (armedReset = true);
			armedReset = false;
			theme.reset();
			tick(true);
		}}>{armedReset ? 'Tap again to reset colors and font' : 'Reset colors and font'}</button
	>
</Sheet>

<style>
	.label {
		margin: 6px 0 0;
	}
	h3 {
		margin: 14px 0 0;
		font-size: calc(1.8rem / var(--font-wide));
		border-bottom: 2px solid var(--line);
		padding-bottom: 4px;
	}
	select {
		font-family: var(--font);
		font-style: var(--font-style);
		font-weight: var(--font-body-weight);
		cursor: pointer;
	}
	.warn {
		margin: 0;
		color: var(--danger);
	}
	.fonts {
		display: grid;
	}
	.font {
		text-align: left;
		background: none;
		border: 0;
		border-bottom: 2px solid var(--line);
		color: var(--ink);
		font-size: calc(1.8rem / var(--font-wide));
		text-transform: uppercase;
		padding: 8px 2px;
		cursor: pointer;
	}
	.preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 14px 0 10px;
		border: 2px solid var(--line);
	}
	.preview .display {
		font-size: calc(1.9rem / var(--font-wide));
	}
	.preview .big {
		font-size: calc(5.5rem / var(--font-wide));
	}
</style>
