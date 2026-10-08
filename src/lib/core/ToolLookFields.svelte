<script lang="ts">
	/**
	 * Appearance for the open tool only. Every control starts on "Global"
	 * (follow Settings); picking anything else overrides just that key for
	 * this tool. Used inside a tool's settings sheet.
	 */
	import ColorField from '#lib/ui/ColorField.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { FONTS, READ_FONTS, SWATCHES, globalLook, resolveInk, toolTheme } from './theme.svelte';
	import { offlineFonts, watchOfflineFonts } from './offlineFonts.svelte';

	const g = $derived(globalLook());
	const t = $derived(toolTheme.look);

	// Offline, only fonts this device has saved are offered (plus whatever is picked now).
	watchOfflineFonts();
	const fonts = $derived(Object.entries(FONTS).filter(([id, f]) => id === t.font || offlineFonts.usable(f.file)));
	const readFonts = $derived(Object.entries(READ_FONTS).filter(([id, f]) => id === t.read || offlineFonts.usable(f.file)));

	function pick(patch: Parameters<typeof toolTheme.set>[0]) {
		unlockFeedback();
		tick();
		toolTheme.set(patch);
	}
	const color = (key: 'bg' | 'ink' | 'accent') => (v: string) => toolTheme.set({ [key]: v === 'default' ? null : v });
</script>

<h3 class="display">Colors</h3>
<p class="label">"Global" follows the app's Settings.</p>
<ColorField
	label="Background"
	value={t.bg ?? 'default'}
	swatches={SWATCHES.bg}
	special={{ value: 'default', label: 'Global', shows: g.bg }}
	onchange={color('bg')}
/>
<ColorField
	label="Text"
	value={t.ink && t.ink !== 'auto' ? t.ink : 'default'}
	swatches={SWATCHES.ink}
	special={{ value: 'default', label: 'Global', shows: resolveInk(g.ink, t.bg ?? g.bg) }}
	onchange={color('ink')}
/>
<ColorField
	label="Accent"
	value={t.accent ?? 'default'}
	swatches={SWATCHES.accent}
	special={{ value: 'default', label: 'Global', shows: g.accent }}
	onchange={color('accent')}
/>

<h3 class="display">Font</h3>
<div class="list" role="radiogroup" aria-label="Display font">
	<button type="button" role="radio" aria-checked={!t.font} class="opt" onclick={() => pick({ font: null })}>
		<span class:tag={!t.font}>Global · {FONTS[g.font as keyof typeof FONTS].name}</span>
	</button>
	{#each fonts as [id, f] (id)}
		<button
			type="button"
			role="radio"
			aria-checked={t.font === id}
			class="opt display"
			style:font-family={f.family}
			style:font-style={f.style}
			onclick={() => pick({ font: id })}
		>
			<span class:tag={t.font === id}>{f.name}</span>
		</button>
	{/each}
</div>

<h3 class="display">Reading font</h3>
<div class="list" role="radiogroup" aria-label="Reading font">
	<button type="button" role="radio" aria-checked={!t.read} class="opt" onclick={() => pick({ read: null })}>
		<span class:tag={!t.read}>Global · {READ_FONTS[g.read as keyof typeof READ_FONTS].name}</span>
	</button>
	{#each readFonts as [id, f] (id)}
		<button
			type="button"
			role="radio"
			aria-checked={t.read === id}
			class="opt"
			style:font-family="{f.family}, system-ui, sans-serif"
			onpointerenter={() => f.load()}
			onclick={() => pick({ read: id })}
		>
			<span class:tag={t.read === id}>{f.name}</span>
		</button>
	{/each}
</div>

<style>
	h3 {
		margin: 14px 0 0;
		font-size: calc(1.8rem / var(--font-wide));
		border-bottom: 2px solid var(--line);
		padding-bottom: 4px;
	}
	.label {
		margin: 0;
	}
	.list {
		display: grid;
	}
	.opt {
		text-align: left;
		background: none;
		border: 0;
		border-bottom: 2px solid var(--line);
		color: var(--ink);
		font-size: 1.15rem;
		padding: 8px 2px;
		cursor: pointer;
	}
</style>
