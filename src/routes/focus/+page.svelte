<script lang="ts">
	/*
	 * FOCUS. A pomodoro timer: pick a preset, say what the block is for,
	 * press start. The run is saved as timestamps, so it carries on across
	 * reloads and closed tabs. One timer per device; presets, tasks and the
	 * log go through Sync all.
	 */
	import { onMount } from 'svelte';
	import RollingNumber from '#lib/ui/RollingNumber.svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { feedback } from '#lib/core/feedbackPrefs.svelte.ts';
	import { FocusTimer } from '#lib/focus/timer.svelte.ts';
	import { CLASSIC, pickPreset, withClassic, type Preset } from '#lib/focus/presets.ts';
	import { newTask, type Task } from '#lib/focus/tasks.ts';
	import { formatMinutes, todayTotals, toTrim, type LogRow } from '#lib/focus/log.ts';
	import { loadAll, putPreset, putTask, record, tombstone } from '#lib/focus/db.ts';
	import { KEEP_DAYS, loadFocusPrefs, saveKeep, saveNotify, savePresetId, saveRules, saveRun, saveWakeLock, type Keep } from '#lib/focus/prefs.ts';
	import { askNotify, chime, holdScreen, notify, notifyState, permission, phaseText } from '#lib/focus/alerts.ts';
	import type { Rules, Run } from '#lib/focus/engine.ts';
	import Ring from '#lib/focus/Ring.svelte';
	import LabelField from '#lib/focus/LabelField.svelte';
	import TaskList from '#lib/focus/TaskList.svelte';
	import FocusSettings from '#lib/focus/FocusSettings.svelte';

	let presets = $state<Preset[]>([]);
	let tasks = $state<Task[]>([]);
	let log = $state<LogRow[]>([]);
	let presetId = $state(CLASSIC.id);
	let keep = $state<Keep>('month');
	let notifyOn = $state(true);
	let perm = $state<NotificationPermission | undefined>(undefined);
	let wakeLock = $state(false);
	let ready = $state(false);
	let settings = $state(false);
	let clock = $state(Date.now());
	// What the next block is for, until a run starts (then the run holds it).
	let draft = $state<{ label: string; taskId: string | null }>({ label: '', taskId: null });

	// Other FOCUS windows on this device (the installed app and a tab): one timer, so they follow each other.
	const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('focus');

	const timer = new FocusTimer(
		{
			saveRun: async (r: Run | null) => {
				await saveRun(r);
				channel?.postMessage(r);
			},
			record
		},
		{
			chime,
			notify: (p, next, waiting) => {
				if (!notifyOn) return;
				const { title, body } = phaseText(p, next, waiting);
				notify(title, body);
			}
		}
	);
	timer.onEnded = (rows) => {
		log = [...log, ...rows];
		const done = rows.filter((r) => r.completed && r.taskId).map((r) => r.taskId);
		if (done.length) tasks = tasks.map((t) => (done.includes(t.id) ? { ...t, count: t.count + done.filter((id) => id === t.id).length } : t));
	};

	const list = $derived(withClassic(presets));
	const preset = $derived(pickPreset(list, presetId));
	const run = $derived(timer.run);
	const running = $derived(!!run && run.startedAt !== null && run.pausedAt === null);
	const label = $derived(run ? { label: run.label, taskId: run.taskId } : draft);
	const today = $derived(todayTotals(log, clock));
	const total = $derived(run ? run.lengths[run.phase] * 60_000 : preset.focus * 60_000);
	const phaseName = $derived(run?.phase === 'break' ? 'Break' : run?.phase === 'long' ? 'Long break' : 'Focus');
	const digits = $derived.by(() => {
		const s = Math.ceil(timer.left / 1000);
		return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
	});

	onMount(() => {
		Promise.all([loadAll(), loadFocusPrefs()]).then(async ([data, p]) => {
			const now = Date.now();
			// Trim the log to the Keep setting (tombstones, so Sync all doesn't bring the rows back).
			const old = toTrim(data.log, KEEP_DAYS[p.keep], now);
			await tombstone('log', old, now);
			presets = data.presets;
			tasks = data.tasks;
			log = data.log.filter((r) => !old.includes(r.id));
			presetId = p.preset ?? CLASSIC.id;
			keep = p.keep;
			notifyOn = p.notify;
			wakeLock = p.wakeLock;
			perm = permission();
			timer.load(p.run, p.rules);
			ready = true;
		});
		const every = setInterval(() => {
			if (document.visibilityState !== 'visible') return;
			timer.sync();
			clock = Date.now();
		}, 1000);
		const onShow = () => {
			if (document.visibilityState !== 'visible') return;
			timer.sync();
			clock = Date.now();
			perm = permission();
		};
		document.addEventListener('visibilitychange', onShow);
		// Browsers only allow sound after a touch: after a reload mid-run, the first tap or key anywhere arms the chime.
		const arm = () => unlockFeedback();
		addEventListener('pointerdown', arm, { once: true });
		addEventListener('keydown', arm, { once: true });
		const onOther = async (e: MessageEvent<Run | null>) => {
			timer.adopt(e.data);
			const data = await loadAll();
			tasks = data.tasks;
			log = data.log.filter((r) => !r.deleted);
		};
		channel?.addEventListener('message', onOther);
		return () => {
			removeEventListener('pointerdown', arm);
			removeEventListener('keydown', arm);
			channel?.close();
			clearInterval(every);
			document.removeEventListener('visibilitychange', onShow);
			timer.dispose();
			holdScreen(false);
		};
	});

	$effect(() => {
		holdScreen(wakeLock && running);
	});

	async function start() {
		unlockFeedback();
		tick();
		timer.start(preset, draft.label, draft.taskId);
		// Asked once, on the first start (only while the browser hasn't been asked).
		if (notifyOn && permission() === 'default') perm = await askNotify();
	}

	/** The big button: start, pause, resume, or start a waiting phase. */
	function main() {
		if (!run) return start();
		unlockFeedback();
		tick();
		if (running) timer.pause();
		else timer.resume();
	}

	function skip() {
		if (!run) return;
		tick();
		timer.skip();
	}

	function stop() {
		if (!run) return;
		tick(true);
		timer.stop();
	}

	function setLabel(l: string, taskId: string | null) {
		if (run) timer.setLabel(l, taskId);
		else draft = { label: l, taskId };
	}

	function choosePreset(p: Preset) {
		if (run) return;
		tick();
		presetId = p.id;
		savePresetId(p.id);
	}

	function onkey(e: KeyboardEvent) {
		const el = e.target as HTMLElement;
		if (!ready || settings || el.closest('input, textarea, select, [contenteditable]')) return;
		if (e.key === ' ') {
			e.preventDefault();
			main();
		} else if (e.key === 's' || e.key === 'S') skip();
	}

	/* ---------- tasks ---------- */

	function addTask(name: string, estimate: number | null) {
		const t = newTask(name, estimate, Date.now());
		tasks = [...tasks, t];
		putTask(t);
	}

	function toggleTask(t: Task) {
		tick();
		const now = Date.now();
		const next = { ...t, doneAt: t.doneAt === null ? now : null, updatedAt: now };
		tasks = tasks.map((x) => (x.id === t.id ? next : x));
		putTask(next);
		// Finishing the linked task unlinks it from what's next.
		if (next.doneAt !== null && label.taskId === t.id) setLabel(label.label, null);
	}

	function clearDone() {
		const now = Date.now();
		const ids = tasks.filter((t) => !t.deleted && t.doneAt !== null).map((t) => t.id);
		tasks = tasks.map((t) => (ids.includes(t.id) ? { ...t, deleted: true, updatedAt: now } : t));
		tombstone('tasks', ids, now);
	}

	/* ---------- settings ---------- */

	function savePreset(p: Preset) {
		const next = { ...p, updatedAt: Date.now() };
		presets = presets.some((x) => x.id === p.id) ? presets.map((x) => (x.id === p.id ? next : x)) : [...presets, next];
		putPreset(next);
	}

	function deletePreset(id: string) {
		const now = Date.now();
		presets = presets.map((p) => (p.id === id ? { ...p, deleted: true, updatedAt: now } : p));
		tombstone('presets', [id], now);
	}

	function setRules(r: Rules) {
		timer.rules = r;
		saveRules(r);
	}

	async function setKeep(k: Keep) {
		keep = k;
		saveKeep(k);
		const now = Date.now();
		const old = toTrim(log, KEEP_DAYS[k], now);
		await tombstone('log', old, now);
		log = log.filter((r) => !old.includes(r.id));
	}

	async function setNotify(on: boolean) {
		notifyOn = on;
		saveNotify(on);
		if (on) perm = await askNotify();
	}

	function setWakeLock(on: boolean) {
		wakeLock = on;
		saveWakeLock(on);
	}

	async function clearLog() {
		const now = Date.now();
		await tombstone(
			'log',
			log.map((r) => r.id),
			now
		);
		log = [];
	}

	function toggle(key: 'sound' | 'haptics') {
		unlockFeedback();
		feedback.set({ [key]: !feedback[key] });
		tick();
	}
</script>

<svelte:head><title>{run && run.startedAt !== null ? `${digits} · ${phaseName}` : 'FOCUS'}</title></svelte:head>
<svelte:window onkeydown={onkey} />

<main class="screen">
	<header class="top">
		<a class="circle" href="/" aria-label="Back to tools">←</a>
		<span class="spacer"></span>
		<button type="button" class="circle" class:off={!feedback.sound} aria-pressed={feedback.sound} aria-label="Sound" onclick={() => toggle('sound')}>♪</button>
		<button type="button" class="circle" class:off={!feedback.haptics} aria-pressed={feedback.haptics} aria-label="Haptics" onclick={() => toggle('haptics')}>≋</button>
		<button type="button" class="circle" aria-label="Focus settings" onclick={() => (settings = true)}>⚙</button>
	</header>

	{#if ready}
		<div class="presets" role="radiogroup" aria-label="Preset">
			{#each list as p (p.id)}
				<button type="button" role="radio" class="display" aria-checked={p.id === preset.id} disabled={!!run && p.id !== preset.id} onclick={() => choosePreset(p)}>
					<span class:tag={p.id === preset.id}>{p.name}</span>
				</button>
			{/each}
		</div>

		<Ring
			left={run ? timer.left : total}
			{total}
			phase={run?.phase ?? 'focus'}
			round={run?.round ?? 1}
			every={run?.lengths.every ?? preset.every}
			waiting={!!run && run.startedAt === null}
			paused={!!run && run.pausedAt !== null}
		/>

		<div class="controls">
			<button type="button" class="btn" disabled={!run} onclick={stop}>Stop</button>
			<button type="button" class="btn btn-primary main" onclick={main}>{!run || run.startedAt === null ? 'Start' : running ? 'Pause' : 'Resume'}</button>
			<button type="button" class="btn" disabled={!run} onclick={skip}>Skip</button>
		</div>

		<LabelField label={label.label} taskId={label.taskId} {tasks} onchange={setLabel} />

		<a class="today" href="/focus/log">
			<span class="label">Today</span>
			<span class="display"><RollingNumber value={today.pomodoros} /> 🍅 · {formatMinutes(today.minutes)}</span>
			<span class="circle" aria-hidden="true">→</span>
		</a>

		<TaskList {tasks} current={label.taskId} onadd={addTask} ontoggle={toggleTask} onclear={clearDone} onpick={(t) => setLabel(t.name, t.id)} />
	{/if}

	{#if settings}
		<FocusSettings
			presets={list}
			rules={timer.rules}
			{keep}
			notify={notifyState(notifyOn, perm)}
			{wakeLock}
			onpreset={savePreset}
			ondelete={deletePreset}
			onrules={setRules}
			onkeep={setKeep}
			onnotify={setNotify}
			onwakelock={setWakeLock}
			onclearlog={clearLog}
			onclose={() => (settings = false)}
		/>
	{/if}
</main>

<style>
	.screen {
		box-sizing: border-box;
		min-height: 100dvh;
		max-width: 620px;
		margin: 0 auto;
		display: grid;
		gap: 16px;
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
	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
		border-bottom: 2px solid var(--line);
		padding-bottom: 6px;
	}
	.presets button {
		border: 0;
		background: none;
		color: var(--dim);
		font-size: calc(1.5rem / var(--font-wide));
		cursor: pointer;
		padding: 2px 0;
	}
	.presets button[aria-checked='true'] {
		color: var(--accent-ink);
	}
	.presets button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.controls {
		display: grid;
		grid-template-columns: 1fr 1.4fr 1fr;
		gap: 10px;
	}
	.today {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 12px;
		border-top: 2px solid var(--line);
		padding-top: 8px;
		color: var(--ink);
		text-decoration: none;
	}
	.today .display {
		font-size: calc(1.6rem / var(--font-wide));
		display: flex;
		gap: 0.25em;
	}
</style>
