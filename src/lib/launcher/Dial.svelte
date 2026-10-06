<script lang="ts">
	/**
	 * The launcher's clock dial. Tools stand on the rim of a big circle
	 * off the left edge; the one at 3 o'clock sits under the accent slab.
	 *
	 * Turn: drag along the arc (momentum, a tick per tool, loops forever).
	 * Open: pull the slab right past the line, or tap it and it pulls
	 * itself. Tap a spoke to turn to it. Keys: ↑/↓, Home/End, Enter/Space.
	 * The geometry and physics are in dial.ts and detent.svelte.ts.
	 */
	import { untrack } from 'svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { Detent } from '#lib/ui/detent.svelte.ts';
	import { toolNumber } from '#lib/ui/transition/plan.ts';
	import {
		AUTO_PULL_MS,
		Once,
		PULL_THRESHOLD,
		PointerOwner,
		STEP_DEG,
		angleAt,
		geometry,
		lockDirection,
		pulledPast,
		releaseAction,
		rubber,
		spoke,
		ticks,
		wrap,
		type DialTool
	} from './dial';

	let {
		tools,
		selected = $bindable(0),
		onlaunch
	}: { tools: DialTool[]; selected?: number; onlaunch: (index: number) => void } = $props();

	const n = $derived(tools.length);

	const remember = (key: string) => {
		try {
			return localStorage.getItem(key) === '1';
		} catch {
			return false;
		}
	};
	const keep = (key: string) => {
		try {
			localStorage.setItem(key, '1');
		} catch {
			/* private mode: fine, just not remembered */
		}
	};

	let hasTurned = remember('launcher:turned');
	const detent = new Detent(
		untrack(() => selected),
		{
			onNotch: (r) => {
				selected = wrap(r, tools.length);
				tick();
				if (!hasTurned) {
					hasTurned = true;
					nudge = false;
					keep('launcher:turned');
				}
			}
		}
	);

	let el: HTMLDivElement;
	let w = $state(0);
	let h = $state(0);
	const g = $derived(geometry(w, h));
	const current = $derived(tools[wrap(detent.rounded, n)]);
	const slots = $derived.by(() => {
		const r = Math.round(detent.pos);
		const out = [];
		for (let v = r - 4; v <= r + 4; v++) {
			const d = v - detent.pos;
			out.push({ v, tool: tools[wrap(v, n)], angle: d * STEP_DEG, look: spoke(d) });
		}
		return out;
	});
	const ring = $derived(ticks(detent.pos));

	/* ---------- the slab ---------- */
	let pull = $state(0); // px the slab is pulled right
	let slab = $state<'idle' | 'drag' | 'back' | 'auto' | 'fling'>('idle');
	let pressed = $state(false);
	let past = false;
	/** One launch per visit: a second tap or finger can't start another. */
	const opening = new Once();

	function launch() {
		slab = 'fling';
		onlaunch(wrap(detent.rounded, n));
	}

	/** A tap: press in, then pull itself out past the line, then fling. */
	function autoPull() {
		if (slab === 'fling' || slab === 'auto' || !opening.claim()) return;
		tick();
		pressed = true;
		setTimeout(() => {
			pressed = false;
			slab = 'auto';
			pull = w * PULL_THRESHOLD;
			setTimeout(() => {
				tick(true);
				launch();
			}, AUTO_PULL_MS);
		}, 70);
	}

	/* ---------- pointer ---------- */
	let mode: 'turn' | 'pull' | null = null;
	let startX = 0;
	let startY = 0;
	let startAngle = 0;
	let startPos = 0;
	let onSlab = false;
	let spokeV: number | null = null;
	/** Only the first finger drives; a second one is ignored until it lifts. */
	const finger = new PointerOwner();

	const local = (e: PointerEvent) => {
		const r = el.getBoundingClientRect();
		return angleAt(e.clientX - r.left, e.clientY - r.top, g);
	};

	function down(e: PointerEvent) {
		if (slab === 'fling' || slab === 'auto' || !finger.take(e.pointerId)) return;
		e.preventDefault();
		unlockFeedback();
		const target = e.target as HTMLElement;
		onSlab = !!target.closest('.slab');
		const sp = target.closest<HTMLElement>('[data-v]');
		spokeV = sp ? Number(sp.dataset.v) : null;
		startX = e.clientX;
		startY = e.clientY;
		startAngle = local(e);
		startPos = detent.pos;
		mode = null;
		past = false;
		detent.grab();
		el.setPointerCapture(e.pointerId);
	}

	function move(e: PointerEvent) {
		if (!finger.owns(e.pointerId)) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		mode ??= lockDirection(dx, dy, onSlab);
		if (mode === 'turn') {
			detent.moveTo(startPos - (local(e) - startAngle) / STEP_DEG);
		} else if (mode === 'pull') {
			slab = 'drag';
			pull = rubber(dx, w);
			const now = pulledPast(pull, w);
			if (now !== past) {
				past = now;
				if (now) tick(true);
			}
		}
	}

	/** Finger up, or the system took the pointer away (cancelled: never opens anything). */
	function finish(e: PointerEvent, cancelled: boolean) {
		if (!finger.release(e.pointerId)) return;
		if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
		const action = releaseAction(mode, past, cancelled);
		mode = null;
		if (action === 'launch') {
			if (opening.claim()) launch();
		} else if (action === 'snap') {
			slab = 'back';
			pull = 0;
			tick();
		} else if (action === 'throw') detent.release();
		else if (action === 'settle') detent.animateTo(detent.rounded);
		else if (onSlab) autoPull();
		else if (spokeV !== null) detent.animateTo(spokeV);
		else detent.animateTo(detent.rounded);
	}

	/* ---------- wheel + keys ---------- */
	let lastWheel = 0;
	function wheel(e: WheelEvent) {
		e.preventDefault();
		unlockFeedback();
		const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
		if (!d || e.timeStamp - lastWheel < 120) return;
		lastWheel = e.timeStamp;
		detent.animateTo(detent.rounded + Math.sign(d));
	}
	$effect(() => {
		el.addEventListener('wheel', wheel, { passive: false });
		return () => {
			el.removeEventListener('wheel', wheel);
			detent.stop();
		};
	});

	function key(e: KeyboardEvent) {
		const k = e.key;
		if (k === 'ArrowDown' || k === 'ArrowUp') {
			e.preventDefault();
			unlockFeedback();
			detent.animateTo(detent.rounded + (k === 'ArrowDown' ? 1 : -1));
		} else if (k === 'Home' || k === 'End') {
			e.preventDefault();
			unlockFeedback();
			const at = wrap(detent.rounded, n);
			detent.animateTo(detent.rounded + ((k === 'Home' ? 0 : n - 1) - at));
		} else if (k === 'Enter' || k === ' ') {
			e.preventDefault();
			unlockFeedback();
			autoPull();
		}
	}

	/* ---------- the "turn me" nudge: once, after 4s idle, until the first turn ---------- */
	let nudge = $state(false);
	$effect(() => {
		if (hasTurned) return;
		const t = setTimeout(() => (nudge = true), 4000);
		return () => clearTimeout(t);
	});
</script>

<div
	class="dial"
	bind:this={el}
	bind:clientWidth={w}
	bind:clientHeight={h}
	role="listbox"
	tabindex="0"
	aria-label="Tools"
	aria-activedescendant={current ? `dial-${current.id}` : undefined}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={(e) => finish(e, false)}
	onpointercancel={(e) => finish(e, true)}
	onkeydown={key}
>
	<!-- What screen readers get: a plain list of the tools. -->
	<div class="sr-only">
		{#each tools as t, i (t.id)}
			<div role="option" id="dial-{t.id}" aria-selected={i === selected}>{t.name}{t.line ? `, ${t.line}` : ''}</div>
		{/each}
	</div>

	<div class="art" aria-hidden="true">
		<div class="ring" style:left="{g.cx - g.r}px" style:top="{g.cy - g.r}px" style:width="{g.r * 2}px" style:height="{g.r * 2}px"></div>
		<div class="hub" style:left="{g.cx}px" style:top="{g.cy}px">
			{#each ring as t (t.k)}
				<i class="tick" class:major={t.major} style:transform="rotate({t.angle}deg) translateX({g.r - (t.major ? 16 : 9)}px)"></i>
			{/each}
			{#each slots as s (s.v)}
				<span
					class="spoke display {s.look.tone}"
					data-v={s.v}
					style:transform="rotate({s.angle}deg) translateX({g.r + 16}px) scale({s.look.scale})"
					style:opacity={s.look.opacity}>{s.tool.name}</span
				>
			{/each}
		</div>
		<i class="pointer" style:left="{g.cx + g.r - 18}px" style:top="{g.cy - 2}px"></i>
		<span class="arrow up" class:nudge style:left="{g.cx + g.r - 34}px" style:top="{g.cy - 64}px">▲</span>
		<span class="arrow down" class:nudge style:left="{g.cx + g.r - 34}px" style:top="{g.cy + 44}px">▼</span>
	</div>

	{#if current}
		<div class="slab {slab}" class:pressed style:left="{g.cx + g.r + 8}px" style:top="{g.cy}px" style:--pull="{pull}px">
			<span class="num">{toolNumber(wrap(detent.rounded, n))}</span>
			<span class="name display">{current.name}</span>
			{#if current.line}<span class="line">{current.line}</span>{/if}
			<span class="chev display" aria-hidden="true"><b>›</b><b>›</b><b>›</b></span>
		</div>
	{/if}
</div>

<style>
	.dial {
		position: relative;
		flex: 1;
		min-height: 360px;
		overflow: hidden;
		touch-action: none;
		user-select: none;
		cursor: grab;
	}
	.dial:focus-visible {
		outline: none;
	}
	.dial:focus-visible .slab {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.art {
		position: absolute;
		inset: 0;
	}
	.ring {
		position: absolute;
		box-sizing: border-box;
		border: 2px solid var(--ink);
		border-radius: 50%;
	}
	/* The dial's face: a darker disc just inside the rim. */
	.ring::after {
		content: '';
		position: absolute;
		inset: 22px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 6%, var(--bg));
		border: 2px solid var(--faint);
	}
	.hub {
		position: absolute;
		width: 0;
		height: 0;
	}
	.tick {
		position: absolute;
		left: 0;
		top: -1px;
		width: 7px;
		height: 2px;
		background: var(--dim);
		transform-origin: 0 50%;
	}
	.tick.major {
		width: 14px;
		background: var(--ink);
	}
	.spoke {
		position: absolute;
		left: 0;
		top: 0;
		height: 1em;
		margin-top: -0.5em;
		line-height: 1em;
		white-space: nowrap;
		transform-origin: 0 50%;
		font-size: calc(3rem / var(--font-wide));
		cursor: pointer;
	}
	.spoke.ink {
		color: var(--ink);
	}
	.spoke.dim {
		color: var(--dim);
	}
	.spoke.faint {
		color: var(--faint);
	}
	.pointer {
		position: absolute;
		width: 18px;
		height: 4px;
		background: var(--accent);
	}
	.arrow {
		position: absolute;
		font-family: var(--font-mono);
		font-style: normal;
		font-size: 1rem;
		color: var(--accent);
	}
	.arrow.up.nudge {
		animation: nudge-up 520ms ease-in-out 2;
	}
	.arrow.down.nudge {
		animation: nudge-down 520ms ease-in-out 2;
	}
	@keyframes nudge-up {
		50% {
			transform: translateY(-5px);
		}
	}
	@keyframes nudge-down {
		50% {
			transform: translateY(5px);
		}
	}

	.slab {
		position: absolute;
		right: -20px;
		/* On a wide screen it stays a slab, not a stripe across the window. */
		max-width: 560px;
		height: 7.6rem;
		padding: 0 0 0 22px;
		background: var(--accent);
		color: var(--accent-ink);
		clip-path: polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
		transform: translate(var(--pull), -50%);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.slab.pressed {
		scale: 0.97;
	}
	/* Snapping back overshoots a little; the self-pull eases in like a hand. */
	.slab.back {
		transition: transform 220ms cubic-bezier(0.2, 1.4, 0.4, 1);
	}
	.slab.auto {
		transition: transform 180ms cubic-bezier(0.5, 0, 0.75, 0);
	}
	.slab.fling {
		transition: transform 110ms cubic-bezier(0.7, 0, 0.84, 0);
		transform: translate(130vw, -50%) rotate(-6deg);
	}
	/* Sized to fit a 6-letter name beside the chevrons on a phone; longer names clip. */
	.name {
		font-size: min(calc(4.6rem / var(--font-wide)), 19vw);
		white-space: nowrap;
		overflow: hidden;
		max-width: calc(100% - 6rem);
		/* Room for the italic's overhang, which overflow would otherwise clip. */
		padding-right: 0.12em;
	}
	.num,
	.line {
		font-family: var(--font-mono);
		font-style: normal;
		font-weight: 700;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
	}
	.num {
		position: absolute;
		top: 10px;
		right: 46px;
	}
	.line {
		margin-top: 4px;
	}
	.chev {
		position: absolute;
		right: 40px;
		top: 50%;
		translate: 0 -50%;
		font-size: 3.4rem;
		display: flex;
	}
	.chev b {
		font-weight: inherit;
		animation: drift 1.6s ease-in-out infinite;
	}
	.chev b:nth-child(2) {
		animation-delay: 0.15s;
		opacity: 0.6;
	}
	.chev b:nth-child(3) {
		animation-delay: 0.3s;
		opacity: 0.3;
	}
	@keyframes drift {
		50% {
			transform: translateX(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chev b,
		.arrow.nudge {
			animation: none;
		}
	}
</style>
