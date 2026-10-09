<script lang="ts">
	/*
	 * FIDGET. A loop of tactile toys. Every press counts; the counts and
	 * unlocked facts stay on this device (in backups, never synced). Only
	 * the loop at the top changes toy: swiping on a toy just plays with it.
	 */
	import { onMount } from 'svelte';
	import WalletLoop from '#lib/ui/WalletLoop.svelte';
	import RollingNumber from '#lib/ui/RollingNumber.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { feedback } from '#lib/core/feedbackPrefs.svelte.ts';
	import { TOY_IDS, TOY_LABELS, DEFAULT_TOY_PREFS, type ToyPrefs } from '#lib/fidget/toys.ts';
	import { loadFidgetPrefs, saveToy, saveToyPrefs } from '#lib/fidget/prefs.ts';
	import { FACT_SHOW_MS, TRIVIA, conversion, type Fact } from '#lib/fidget/facts.ts';
	import { loadCounts, saveCounts, saveFact } from '#lib/fidget/db.ts';
	import { Counter } from '#lib/fidget/counter.svelte.ts';
	import Bubbles from '#lib/fidget/Bubbles.svelte';
	import Keycaps from '#lib/fidget/Keycaps.svelte';
	import Ratchet from '#lib/fidget/Ratchet.svelte';
	import Switches from '#lib/fidget/Switches.svelte';
	import Pen from '#lib/fidget/Pen.svelte';
	import Slider from '#lib/fidget/Slider.svelte';
	import FidgetSettings from '#lib/fidget/FidgetSettings.svelte';
	import Unlock from '#lib/fidget/Unlock.svelte';

	const counter = new Counter({ saveCounts, saveFact });
	const items = TOY_IDS.map((id) => ({ id, label: TOY_LABELS[id] }));

	let selected = $state(0);
	let prefs = $state<ToyPrefs>({ ...DEFAULT_TOY_PREFS, keys: [...DEFAULT_TOY_PREFS.keys] });
	let ready = $state(false);
	let settings = $state(false);
	let fact = $state<Fact | null>(null);
	let factTimer: ReturnType<typeof setTimeout> | undefined;

	const toy = $derived(TOY_IDS[selected]);
	const count = $derived(counter.counts[toy]);

	onMount(() => {
		Promise.all([loadFidgetPrefs(), loadCounts()]).then(([p, saved]) => {
			prefs = p.toys;
			selected = TOY_IDS.indexOf(p.toy);
			counter.load(saved);
			ready = true;
		});
		// Phones kill background tabs without warning: write as soon as the app is hidden.
		const onHide = () => document.visibilityState === 'hidden' && counter.flush();
		document.addEventListener('visibilitychange', onHide);
		return () => {
			document.removeEventListener('visibilitychange', onHide);
			counter.flush();
			clearTimeout(factTimer);
		};
	});

	// Reopen on the toy you were on. (Only after loading, or it would save the default over it.)
	$effect(() => {
		if (ready) saveToy(toy);
	});

	function act() {
		const unlocked = counter.add(toy);
		if (!unlocked) return;
		fact = unlocked;
		tick(true);
		clearTimeout(factTimer);
		factTimer = setTimeout(() => (fact = null), FACT_SHOW_MS);
	}

	function changePrefs(next: ToyPrefs) {
		prefs = next;
		saveToyPrefs($state.snapshot(next));
	}

	function toggle(key: 'sound' | 'haptics') {
		unlockFeedback();
		feedback.set({ [key]: !feedback[key] });
		tick();
	}
</script>

<svelte:head><title>FIDGET</title></svelte:head>

<main class="screen">
	<header class="top">
		<a class="circle" href="/" aria-label="Back to tools">←</a>
		<span class="spacer"></span>
		<button type="button" class="circle" class:off={!feedback.sound} aria-pressed={feedback.sound} aria-label="Sound" onclick={() => toggle('sound')}>♪</button>
		<button type="button" class="circle" class:off={!feedback.haptics} aria-pressed={feedback.haptics} aria-label="Haptics" onclick={() => toggle('haptics')}>≋</button>
		<button type="button" class="circle" aria-label="Fidget settings" onclick={() => (settings = true)}>⚙</button>
	</header>

	<div class="loop display"><WalletLoop {items} bind:selected label="Toy" /></div>

	{#if ready}
		<section class="toy" aria-label={TOY_LABELS[toy]}>
			{#if toy === 'bubbles'}
				<Bubbles grid={prefs.grid} onaction={act} />
			{:else if toy === 'keys'}
				<Keycaps keys={prefs.keys} onaction={act} />
			{:else if toy === 'ratchet'}
				<Ratchet detents={prefs.detents} onaction={act} />
			{:else if toy === 'switches'}
				<Switches count={prefs.switches} onaction={act} />
			{:else if toy === 'pen'}
				<Pen onaction={act} />
			{:else}
				<Slider notches={prefs.notches} onaction={act} />
			{/if}
		</section>

		<div class="count">
			<span class="big display"><RollingNumber value={count} fast /></span>
			<p class="label">{conversion(toy, count)}</p>
		</div>

		<a class="facts" href="/fidget/facts">
			<span class="label">Total {counter.total.toLocaleString('en-US')}</span>
			<span class="display">{counter.unlocked.length} / {TRIVIA.length} facts</span>
			<span class="circle" aria-hidden="true">→</span>
		</a>
	{/if}

	{#if fact}
		<Unlock {fact} />
	{/if}
	{#if settings}
		<FidgetSettings {toy} {prefs} onchange={changePrefs} onclose={() => (settings = false)} />
	{/if}
</main>

<style>
	.screen {
		box-sizing: border-box;
		min-height: 100dvh;
		max-width: 620px;
		margin: 0 auto;
		display: grid;
		gap: 14px;
		align-content: start;
		padding: calc(14px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
	}
	.top {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.spacer {
		flex: 1;
	}
	/* Off: the glyph gets struck through. */
	.circle.off {
		position: relative;
		color: var(--dim);
	}
	.circle.off::after {
		content: '';
		position: absolute;
		left: 15%;
		right: 15%;
		top: 50%;
		border-top: 2px solid var(--ink);
		transform: rotate(-45deg);
	}
	.loop {
		border-bottom: 2px solid var(--line);
		padding-bottom: 6px;
	}
	/* Capped so a big sheet of bubbles still leaves the count on screen on a wide window. */
	.toy {
		width: min(100%, 440px);
		justify-self: center;
		min-height: 300px;
		display: grid;
		align-content: center;
	}
	.count {
		display: grid;
		justify-items: center;
		gap: 2px;
	}
	.big {
		font-size: calc(5.5rem / var(--font-wide));
		line-height: 1;
	}
	.count .label {
		margin: 0;
		text-align: center;
	}
	.facts {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		border-top: 2px solid var(--line);
		padding-top: 8px;
		color: var(--ink);
		text-decoration: none;
	}
	.facts .display {
		font-size: calc(1.6rem / var(--font-wide));
	}
	.facts .circle {
		grid-row: span 2;
		grid-column: 2;
		grid-row-start: 1;
	}
</style>
