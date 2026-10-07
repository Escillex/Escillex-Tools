<script lang="ts" generics="T extends { id: string; label: string }">
	/**
	 * An endless horizontal dial of labels. Drag, fling, scroll, tap a
	 * label, or use the arrow keys. Ticks once per label that crosses the
	 * center, and `selected` is the index of the centered one.
	 *
	 * How the loop works: `pos` is a position on an infinite number line
	 * (…-1, 0, 1, 2…). We draw the few slots around `pos`, and slot v shows
	 * items[v mod n]. Scrolling forever just keeps moving `pos`.
	 * The momentum and notch maths live in detent.svelte.ts.
	 *
	 * Optional: draw slots yourself (item snippet), a fixed slot width, and
	 * hold / double-click hooks (BG REMOVE's history dial uses these).
	 */
	import { untrack, type Snippet } from 'svelte';
	import { HOLD_MS, HOLD_TOLERANCE } from '#lib/bgremove/gesture.ts';
	import { tick, unlockFeedback } from './feedback';
	import { Detent } from './detent.svelte';

	let {
		items,
		selected = $bindable(0),
		label = 'Wallet',
		onactivate,
		item,
		slotWidth,
		ondouble,
		onhold,
		onholdmove,
		onholdend
	}: {
		items: T[];
		selected?: number;
		/** What the dial picks, for screen readers. */
		label?: string;
		/** Tapping the label that's already centred (or Enter): "open this one". */
		onactivate?: (e: PointerEvent | KeyboardEvent) => void;
		/** Draw each slot yourself; the boolean is "this one is centred". */
		item?: Snippet<[T, boolean]>;
		/** Fixed distance between slots (skips measuring label text). */
		slotWidth?: number;
		/** Double-click anywhere on the dial. */
		ondouble?: () => void;
		/** Press and hold without moving: the pressed slot is centred first. Then vertical moves until release. */
		onhold?: () => void;
		onholdmove?: (dy: number) => void;
		onholdend?: (dy: number) => void;
	} = $props();

	/*
	 * Distance between label centers. Measured from the widest name in the
	 * current font (wide fonts need more room), plus the tag's padding and a
	 * gap, so the tag never runs into its neighbours.
	 */
	let slot = $state(118);
	let measurer: HTMLDivElement;
	function measure() {
		if (slotWidth) return void (slot = slotWidth);
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

	let el: HTMLDivElement;

	const mod = (a: number, n: number) => ((a % n) + n) % n;

	const detent = new Detent(
		untrack(() => selected),
		{
			onNotch: (r) => {
				selected = mod(r, items.length);
				tick();
			}
		}
	);

	const slots = $derived.by(() => {
		const n = items.length;
		if (n === 0) return [];
		const center = detent.rounded;
		const out = [];
		for (let v = center - VISIBLE; v <= center + VISIBLE; v++) {
			const d = Math.abs(v - detent.pos);
			out.push({
				v,
				item: items[mod(v, n)],
				x: (v - detent.pos) * slot,
				opacity: d < 1 ? 1 - d * 0.62 : Math.max(0, 0.38 - (d - 1) * 0.11)
			});
		}
		return out;
	});

	/* ---------- dragging (and holding) ---------- */
	let dragging = false;
	let holding = false;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let startX = 0;
	let startY = 0;
	let startPos = 0;
	let moved = 0;
	let movedY = 0;

	/** Which slot (as a position on the number line) a pointer x is over. */
	function slotAt(clientX: number) {
		const rect = el.getBoundingClientRect();
		return Math.round(detent.pos + (clientX - (rect.left + rect.width / 2)) / slot);
	}

	function onPointerDown(e: PointerEvent) {
		// Buttons inside a custom slot handle their own clicks.
		if ((e.target as Element).closest('[data-loop-ignore]')) return;
		e.preventDefault(); // don't steal focus (keeps a phone keyboard open in the entry screen)
		unlockFeedback();
		dragging = true;
		holding = false;
		startX = e.clientX;
		startY = e.clientY;
		startPos = detent.pos;
		moved = 0;
		movedY = 0;
		detent.grab();
		el.setPointerCapture(e.pointerId);
		if (onhold) {
			clearTimeout(holdTimer);
			holdTimer = setTimeout(() => {
				if (!dragging || moved > HOLD_TOLERANCE || movedY > HOLD_TOLERANCE) return;
				holding = true;
				detent.animateTo(slotAt(startX));
				onhold();
			}, HOLD_MS);
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		if (holding) return onholdmove?.(e.clientY - startY);
		const dx = e.clientX - startX;
		moved = Math.max(moved, Math.abs(dx));
		movedY = Math.max(movedY, Math.abs(e.clientY - startY));
		detent.moveTo(startPos - dx / slot);
	}

	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		clearTimeout(holdTimer);
		if (holding) {
			holding = false;
			onholdend?.(e.clientY - startY);
			return;
		}

		// A tap (barely moved): jump to the label that was tapped.
		if (moved < 6) {
			const target = slotAt(e.clientX);
			if (target === detent.rounded && onactivate) onactivate(e);
			else detent.animateTo(target);
			return;
		}

		// A fling: keep going in the direction of travel, then snap.
		detent.release();
	}

	/* ---------- mouse wheel / trackpad ---------- */
	let wheelTimer: ReturnType<typeof setTimeout>;
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		unlockFeedback();
		const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
		detent.grab();
		detent.moveTo(detent.pos + delta / slot);
		clearTimeout(wheelTimer);
		wheelTimer = setTimeout(() => detent.animateTo(detent.rounded), 110);
	}

	/* ---------- keyboard ---------- */
	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && onactivate) {
			e.preventDefault();
			onactivate(e);
			return;
		}
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		unlockFeedback();
		detent.animateTo(detent.rounded + (e.key === 'ArrowRight' ? 1 : -1));
	}

	// If `selected` is changed from outside (e.g. another loop bound to the
	// same value), jump to it. untrack: only `selected` should trigger this.
	$effect(() => {
		const target = selected;
		untrack(() => {
			const n = items.length;
			const r = detent.rounded;
			if (n === 0 || mod(r, n) === target) return;
			detent.jump(r + (target - mod(r, n)));
		});
	});

	$effect(() => {
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			el.removeEventListener('wheel', onWheel);
			clearTimeout(holdTimer);
			detent.stop();
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
	ondblclick={() => ondouble?.()}
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
			{#if item}
				{@render item(s.item, centered)}
			{:else}
				<!-- Text switches to the tag's ink only once the tag is solid enough to read on. -->
				<span class:tag={centered} style:--t={t} style:color={t > 0.5 ? 'var(--accent-ink)' : 'var(--ink)'}>{s.item.label}</span>
			{/if}
		</span>
	{/each}
</div>

<style>
	.loop {
		position: relative;
		height: var(--loop-h, 1.6em);
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
		line-height: var(--loop-h, 1.6em);
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
