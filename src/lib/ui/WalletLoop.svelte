<script lang="ts">
	/**
	 * An endless horizontal dial of labels. Drag, fling, scroll, tap a
	 * label, or use the arrow keys. Ticks once per label that crosses the
	 * center, and `selected` is the index of the centered one.
	 *
	 * How the loop works: `pos` is a position on an infinite number line
	 * (…-1, 0, 1, 2…). We draw the few slots around `pos`, and slot v shows
	 * items[v mod n]. Scrolling forever just keeps moving `pos`.
	 */
	import { untrack } from 'svelte';
	import { tick, unlockFeedback } from './feedback';

	let {
		items,
		selected = $bindable(0),
		label = 'Wallet',
		onactivate
	}: {
		items: { id: string; label: string }[];
		selected?: number;
		/** What the dial picks, for screen readers. */
		label?: string;
		/** Tapping the label that's already centred (or Enter): "open this one". */
		onactivate?: () => void;
	} = $props();

	/*
	 * Distance between label centers. Measured from the widest name in the
	 * current font (wide fonts need more room), plus the tag's padding and a
	 * gap, so the tag never runs into its neighbours.
	 */
	let slot = $state(118);
	let measurer: HTMLDivElement;
	function measure() {
		if (!measurer) return;
		const spans = [...measurer.children] as HTMLElement[];
		const widest = Math.max(0, ...spans.map((s) => s.offsetWidth));
		const em = parseFloat(getComputedStyle(measurer).fontSize) || 16;
		slot = Math.max(90, Math.ceil(widest + em * 0.84 + 28));
	}
	// Re-measure when the names change, the font loads, or the font/size changes.
	$effect(() => {
		void items.map((i) => i.label).join('|');
		measure();
		document.fonts?.ready.then(measure);
		const ro = new ResizeObserver(measure);
		ro.observe(measurer);
		return () => ro.disconnect();
	});
	const VISIBLE = 4; // slots drawn on each side

	let pos = $state(selected);
	let lastRounded = Math.round(selected);
	let el: HTMLDivElement;

	const mod = (a: number, n: number) => ((a % n) + n) % n;

	const slots = $derived.by(() => {
		const n = items.length;
		if (n === 0) return [];
		const center = Math.round(pos);
		const out = [];
		for (let v = center - VISIBLE; v <= center + VISIBLE; v++) {
			const d = Math.abs(v - pos);
			out.push({
				v,
				item: items[mod(v, n)],
				x: (v - pos) * slot,
				opacity: d < 1 ? 1 - d * 0.62 : Math.max(0, 0.38 - (d - 1) * 0.11)
			});
		}
		return out;
	});

	/** Called whenever pos moves: tick + update selection when a new label hits center. */
	function settle() {
		const r = Math.round(pos);
		if (r !== lastRounded) {
			lastRounded = r;
			selected = mod(r, items.length);
			tick();
		}
	}

	/* ---------- animation ---------- */
	let frame = 0;
	function animateTo(target: number) {
		cancelAnimationFrame(frame);
		const from = pos;
		const distance = target - from;
		const duration = Math.min(900, 260 + Math.abs(distance) * 70);
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
			pos = from + distance * eased;
			settle();
			if (t < 1) frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
	}

	/* ---------- dragging ---------- */
	let dragging = false;
	let startX = 0;
	let startPos = 0;
	let moved = 0;
	let samples: { t: number; pos: number }[] = [];

	function onPointerDown(e: PointerEvent) {
		e.preventDefault(); // don't steal focus (keeps a phone keyboard open in the entry screen)
		unlockFeedback();
		cancelAnimationFrame(frame);
		dragging = true;
		startX = e.clientX;
		startPos = pos;
		moved = 0;
		samples = [{ t: e.timeStamp, pos }];
		el.setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - startX;
		moved = Math.max(moved, Math.abs(dx));
		pos = startPos - dx / slot;
		samples.push({ t: e.timeStamp, pos });
		if (samples.length > 6) samples.shift();
		settle();
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;

		// A tap (barely moved): jump to the label that was tapped.
		if (moved < 6) {
			const rect = el.getBoundingClientRect();
			const offset = (e.clientX - (rect.left + rect.width / 2)) / slot;
			const target = Math.round(pos + offset);
			if (target === Math.round(pos) && onactivate) onactivate();
			else animateTo(target);
			return;
		}

		// A fling: keep going in the direction of travel, then snap.
		const first = samples[0];
		const last = samples[samples.length - 1];
		const dt = Math.max(1, last.t - first.t);
		const velocity = (last.pos - first.pos) / dt; // slots per ms
		animateTo(Math.round(pos + velocity * 280));
	}

	/* ---------- mouse wheel / trackpad ---------- */
	let wheelTimer: ReturnType<typeof setTimeout>;
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		unlockFeedback();
		cancelAnimationFrame(frame);
		const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		pos += delta / slot;
		settle();
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => animateTo(Math.round(pos)), 110);
	}

	/* ---------- keyboard ---------- */
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && onactivate) {
			e.preventDefault();
			onactivate();
			return;
		}
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		unlockFeedback();
		animateTo(Math.round(pos) + (e.key === 'ArrowRight' ? 1 : -1));
	}

	// If `selected` is changed from outside (e.g. another loop bound to the
	// same value), jump to it. untrack: only `selected` should trigger this.
	$effect(() => {
		const target = selected;
		untrack(() => {
			const n = items.length;
			const r = Math.round(pos);
			if (n === 0 || mod(r, n) === target) return;
			cancelAnimationFrame(frame);
			pos = r + (target - mod(r, n));
			lastRounded = Math.round(pos);
		});
	});

	$effect(() => {
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			el.removeEventListener('wheel', onWheel);
			cancelAnimationFrame(frame);
		};
	});
</script>

<div
	class="loop"
	bind:this={el}
	role="slider"
	tabindex="0"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={items.length - 1}
	aria-valuenow={selected}
	aria-valuetext={items[selected]?.label}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	onkeydown={onKeyDown}
>
	<!-- Invisible copies of every name, used only to measure their widths. -->
	<div class="measurer display" bind:this={measurer} aria-hidden="true">
		{#each items as it (it.id)}<span>{it.label}</span>{/each}
	</div>

	{#each slots as s (s.v)}
		{@const centered = Math.abs(s.x / slot) < 0.5}
		<!-- The tag fades in over the last half-step before a label reaches the center. -->
		{@const t = centered ? 1 - Math.abs(s.x / slot) * 2 : 0}
		<span class="slot display" style:transform="translateX(calc(-50% + {s.x}px))" style:opacity={s.opacity}>
			<!-- Text switches to the tag's ink only once the tag is solid enough to read on. -->
			<span class:tag={centered} style:--t={t} style:color={t > 0.5 ? 'var(--accent-ink)' : 'var(--ink)'}>{s.item.label}</span>
		</span>
	{/each}
</div>

<style>
	.loop {
		position: relative;
		height: 1.6em;
		width: 100%;
		overflow: hidden;
		touch-action: none;
		user-select: none;
		cursor: grab;
		mask-image: linear-gradient(to right, transparent, #000 22%, #000 78%, transparent);
	}
	.loop:active {
		cursor: grabbing;
	}
	.loop:focus-visible {
		outline: none;
	}
	.slot {
		position: absolute;
		left: 50%;
		top: 0;
		white-space: nowrap;
		line-height: 1.6em;
		will-change: transform;
	}
	.measurer {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		white-space: nowrap;
		display: flex;
		align-items: flex-start;
	}
	.measurer span {
		flex: none;
	}
	.slot :global(.tag::before) {
		opacity: var(--t, 1);
	}
</style>
