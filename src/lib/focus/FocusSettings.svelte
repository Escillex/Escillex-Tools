<script lang="ts">
	/** Focus settings: presets, the auto-start rules, alerts, how long the log is kept, and FOCUS's own look. */
	import Sheet from '#lib/ui/Sheet.svelte';
	import ToolLookFields from '#lib/core/ToolLookFields.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { CLASSIC, LIMITS, cleanPreset, type Preset } from './presets';
	import { STOP_AFTER, type Keep } from './prefs';
	import type { Rules } from './engine';
	import type { NotifyState } from './alerts';

	let {
		presets,
		rules,
		keep,
		notify,
		wakeLock,
		onpreset,
		ondelete,
		onrules,
		onkeep,
		onnotify,
		onwakelock,
		onclearlog,
		onclose
	}: {
		presets: Preset[];
		rules: Rules;
		keep: Keep;
		notify: NotifyState;
		wakeLock: boolean;
		onpreset: (p: Preset) => void;
		ondelete: (id: string) => void;
		onrules: (r: Rules) => void;
		onkeep: (k: Keep) => void;
		onnotify: (on: boolean) => void;
		onwakelock: (on: boolean) => void;
		onclearlog: () => void;
		onclose: () => void;
	} = $props();

	const KEEP_LABELS: [Keep, string][] = [
		['week', '1 week'],
		['month', '1 month'],
		['quarter', '3 months'],
		['year', '1 year'],
		['forever', 'Forever']
	];
	const FIELDS: [keyof Pick<Preset, 'focus' | 'break' | 'long' | 'every'>, string][] = [
		['focus', 'Focus min'],
		['break', 'Break min'],
		['long', 'Long break min'],
		['every', 'Long break every']
	];

	// The preset being edited (a copy), or null.
	let editing = $state<Preset | null>(null);
	let confirmClear = $state(false);

	function press() {
		unlockFeedback();
		tick();
	}

	function newPreset() {
		press();
		editing = { ...CLASSIC, id: crypto.randomUUID(), name: 'New preset' };
	}

	function save() {
		const p = editing && cleanPreset(editing);
		if (p) onpreset(p);
		editing = null;
	}

	const notifyText: Record<NotifyState, string> = { on: '', off: '', ask: 'Asks next time you start', blocked: 'Blocked in browser settings', unsupported: 'Not supported here' };
</script>

{#snippet choices<T>(label: string, options: readonly T[], value: T, text: (o: T) => string, pick: (o: T) => void)}
	<p class="label">{label}</p>
	<div class="choices" role="radiogroup" aria-label={label}>
		{#each options as o (o)}
			<button type="button" role="radio" aria-checked={o === value} class="display" onclick={() => (press(), pick(o))}>
				<span class:tag={o === value}>{text(o)}</span>
			</button>
		{/each}
	</div>
{/snippet}

{#snippet sw(text: string, on: boolean, flip: () => void, disabled = false)}
	<button type="button" class="switch" role="switch" aria-checked={on} {disabled} onclick={() => (press(), flip())}>
		<span>{text}</span>
		<span class="dot" class:on></span>
	</button>
{/snippet}

<Sheet title="Focus" {onclose}>
	<h3 class="display">Presets</h3>
	{#if editing}
		<input class="field" aria-label="Preset name" bind:value={editing.name} />
		<div class="nums">
			{#each FIELDS as [key, text] (key)}
				<label>
					<span class="label">{text}</span>
					<input
						class="field"
						type="number"
						inputmode="numeric"
						min={key === 'every' ? LIMITS.every[0] : LIMITS.minutes[0]}
						max={key === 'every' ? LIMITS.every[1] : LIMITS.minutes[1]}
						bind:value={editing[key]}
					/>
				</label>
			{/each}
		</div>
		<div class="row">
			<button type="button" class="btn" onclick={() => (editing = null)}>Cancel</button>
			<button type="button" class="btn btn-primary" onclick={save}>Save</button>
		</div>
	{:else}
		{#each presets as p (p.id)}
			<div class="preset">
				<span class="name">{p.name}</span>
				<span class="label">{p.focus}/{p.break}/{p.long} · every {p.every}</span>
				{#if p.id !== CLASSIC.id}
					<button type="button" class="circle" aria-label="Edit {p.name}" onclick={() => (press(), (editing = { ...p }))}>✎</button>
					<button type="button" class="circle" aria-label="Delete {p.name}" onclick={() => (press(), ondelete(p.id))}>✕</button>
				{/if}
			</div>
		{/each}
		<button type="button" class="btn" onclick={newPreset}>+ Preset</button>
		<p class="label">A running timer keeps the lengths it started with.</p>
	{/if}

	<h3 class="display">Timer</h3>
	{@render sw('Auto-start next phase', rules.autoStart, () => onrules({ ...rules, autoStart: !rules.autoStart }))}
	{#if rules.autoStart}
		{@render choices('Stop after', STOP_AFTER, rules.stopAfter, (n) => (n ? `${n} cycle${n > 1 ? 's' : ''}` : 'Never'), (n) => onrules({ ...rules, stopAfter: n }))}
	{/if}

	<h3 class="display">Alerts</h3>
	{@render sw('Notifications', notify === 'on' || notify === 'ask', () => onnotify(notify === 'off'), notify === 'blocked' || notify === 'unsupported')}
	{#if notifyText[notify]}<p class="label">{notifyText[notify]}</p>{/if}
	{@render sw('Keep screen on', wakeLock, () => onwakelock(!wakeLock))}
	<p class="label">Only while the timer runs. Chimes follow the Sound and Haptics switches.</p>

	<h3 class="display">Log</h3>
	{@render choices(
		'Keep',
		KEEP_LABELS.map(([k]) => k),
		keep,
		(k) => KEEP_LABELS.find(([x]) => x === k)![1],
		onkeep
	)}
	{#if confirmClear}
		<div class="row">
			<button type="button" class="btn" onclick={() => (confirmClear = false)}>Keep it</button>
			<button type="button" class="btn btn-danger" onclick={() => (onclearlog(), (confirmClear = false))}>Clear everything</button>
		</div>
	{:else}
		<button type="button" class="btn btn-danger" onclick={() => (confirmClear = true)}>Clear log</button>
	{/if}

	<ToolLookFields />
</Sheet>

<style>
	.label {
		margin: 0;
	}
	h3 {
		margin: 0;
		font-size: calc(1.8rem / var(--font-wide));
		border-bottom: 2px solid var(--line);
		padding-bottom: 4px;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.choices button {
		border: 0;
		background: none;
		color: var(--dim);
		font-size: calc(1.5rem / var(--font-wide));
		cursor: pointer;
	}
	.choices button[aria-checked='true'] {
		color: var(--accent-ink);
	}
	.preset {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		border-bottom: 1px solid var(--faint);
	}
	.name {
		font-size: 1.05rem;
	}
	.nums {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px 16px;
	}
	.nums label {
		display: grid;
	}
	.row {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}
	.switch {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: none;
		border: 0;
		border-bottom: 2px solid var(--line);
		color: var(--ink);
		font-family: var(--font-read);
		font-style: normal;
		font-size: 1.05rem;
		padding: 8px 2px;
		cursor: pointer;
		text-align: left;
	}
	.switch:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.dot {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--line);
		border-radius: 50%;
	}
	.dot.on {
		background: var(--accent);
		border-color: var(--accent);
	}
</style>
