<script lang="ts">
	/**
	 * The rendered document. Table cells in top-level tables are editable
	 * in place, and checkboxes tick. Each edit is written straight back
	 * into the Markdown through the offsets the renderer leaves on the
	 * HTML (data-src, data-task).
	 *
	 * While a cell is being edited the HTML is left alone (re-rendering
	 * would destroy the cell and close the phone keyboard); the edit is
	 * committed on Tab/Enter/blur.
	 *
	 * Write mode (`write`): every other top-level block (data-block) can
	 * be clicked too; it swaps for a box holding its raw Markdown, with the
	 * toolbar above, and is written back on blur (Escape cancels).
	 */
	import './markdown.css';
	import { tick as flush, untrack } from 'svelte';
	import { tick, unlockFeedback } from '#lib/ui/feedback.ts';
	import { renderMarkdown } from './render';
	import { toggleTask } from './tasks';
	import {
		addColumn,
		addRow,
		escapeCell,
		parseTable,
		removeColumn,
		removeRow,
		serializeTable,
		setCell,
		unescapeCell,
		type Table
	} from './table';
	import { appendBlock, replaceBlock } from './blocks';
	import { applyToTextarea, shortcut, type Transform } from './edit';
	import Toolbar from './Toolbar.svelte';
	import type { Doc } from './doc.svelte';

	let { doc, write = false }: { doc: Doc; write?: boolean } = $props();

	const HUGE = 2_000_000;
	let html = $state('');
	let root: HTMLDivElement;

	// Big files: wait for a pause in typing (Split mode) instead of rendering every keystroke.
	$effect(() => {
		const text = doc.text;
		if (text.length > HUGE && untrack(() => html)) {
			const t = setTimeout(() => (html = renderMarkdown(text)), 300);
			return () => clearTimeout(t);
		}
		html = renderMarkdown(text);
	});

	/*
	 * Throw away the DOM and render again: the edited cell shows raw Markdown, so it must be redrawn after every commit.
	 * The {#key} swaps old for new in one step; emptying the page first would let the browser clamp the scroll position.
	 */
	let renders = $state(0);
	async function rerender() {
		hovered = null; // its cell is about to be replaced
		html = renderMarkdown(doc.text);
		renders++;
		await flush();
	}

	interface Editing {
		cell: HTMLElement;
		table: number; // which editable table (index), stable across a cell edit
		start: number;
		end: number;
		original: string; // the table text when editing began (stale guard)
		row: number;
		col: number;
	}
	let editing = $state<Editing | null>(null);
	let hovered = $state<HTMLElement | null>(null);
	let copied = $state<'ok' | 'fail' | null>(null);
	let committing: Promise<void> = Promise.resolve();

	const tables = () => [...root.querySelectorAll('table[data-src]')];
	const range = (table: Element) => (table.getAttribute('data-src') ?? '').split(':').map(Number) as [number, number];
	const cellAt = (table: number, row: number, col: number) =>
		tables()[table]?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`) ?? null;

	function startEdit(cell: HTMLElement) {
		const table = cell.closest('table[data-src]');
		if (!table) return;
		const [start, end] = range(table);
		const original = doc.text.slice(start, end);
		const t = parseTable(original);
		if (!t) return;
		const row = Number(cell.dataset.row);
		const col = Number(cell.dataset.col);
		const raw = row === 0 ? t.head[col] : t.rows[row - 1][col];
		editing = { cell, table: tables().indexOf(table), start, end, original, row, col };
		cell.classList.add('editing');
		cell.textContent = unescapeCell(raw ?? '');
		cell.contentEditable = 'plaintext-only';
		cell.focus();
		// Caret at the end.
		const sel = getSelection();
		sel?.selectAllChildren(cell);
		sel?.collapseToEnd();
		keyboardFloor = window.visualViewport?.height ?? 0;
	}

	/** Write a table back over its old text. Returns false if the text moved underneath us (stale: drop it). */
	function writeTable(e: Editing, next: Table): boolean {
		if (doc.text.slice(e.start, e.end) !== e.original) return false;
		const out = serializeTable(next);
		if (out !== e.original) doc.change(doc.text.slice(0, e.start) + out + doc.text.slice(e.end));
		return true;
	}

	const typed = (e: Editing) => escapeCell(e.cell.innerText.replace(/\n$/, ''));

	type Move = 'next' | 'prev' | 'down' | null;

	async function commit(move: Move, cancel = false) {
		const e = editing;
		if (!e) return;
		editing = null;
		e.cell.contentEditable = 'false';
		e.cell.classList.remove('editing');
		const t = parseTable(e.original);
		if (!cancel && t) writeTable(e, setCell(t, e.row, e.col, typed(e)));
		await rerender();
		if (!move || !t) return;
		const cols = t.head.length;
		const last = t.rows.length; // last row index (header is 0)
		let { row, col } = e;
		if (move === 'next') [row, col] = col + 1 < cols ? [row, col + 1] : [row + 1, 0];
		if (move === 'prev') [row, col] = col > 0 ? [row, col - 1] : [row - 1, cols - 1];
		if (move === 'down') row++;
		if (row < 0 || row > last) return;
		const next = cellAt(e.table, row, col);
		if (next) startEdit(next);
	}

	/** Every commit goes through here, so a click on another cell can wait for the redraw. */
	function commitNow(move: Move, cancel = false) {
		committing = commit(move, cancel);
		return committing;
	}

	async function changeTable(fn: (t: Table, e: Editing) => Table) {
		const e = editing;
		if (!e) return;
		unlockFeedback();
		tick();
		editing = null;
		const t = parseTable(e.original);
		// Keep whatever was typed in the cell, then apply the row/column change.
		if (t) writeTable(e, fn(setCell(t, e.row, e.col, typed(e)), e));
		committing = rerender();
		await committing;
	}

	async function copy() {
		const cell = editing?.cell ?? hovered;
		if (!cell) return;
		unlockFeedback();
		try {
			await navigator.clipboard.writeText(cell.innerText.trim());
			tick();
			copied = 'ok';
		} catch {
			copied = 'fail';
		}
		setTimeout(() => (copied = null), 1200);
	}

	/* ---- Write mode: one block at a time ---- */

	interface Block {
		area: HTMLTextAreaElement;
		el: HTMLElement | null; // null when adding a new block at the end
		start: number;
		end: number;
		original: string;
	}
	let block = $state<Block | null>(null);

	const blockEls = () => [...root.querySelectorAll<HTMLElement>('[data-block]')];

	function grow(area: HTMLTextAreaElement) {
		area.style.height = 'auto';
		area.style.height = `${area.scrollHeight + 4}px`;
	}

	/** Swap a block (or, with el null, the empty spot after the last block) for a box with its raw Markdown. */
	function openBlock(el: HTMLElement | null) {
		const [start, end] = el
			? ((el.getAttribute('data-block') ?? '').split(':').map(Number) as [number, number])
			: [doc.text.length, doc.text.length];
		const original = doc.text.slice(start, end);
		const area = document.createElement('textarea');
		area.className = 'block-box';
		area.value = original;
		area.spellcheck = true;
		area.setAttribute('aria-label', 'Edit block');
		if (el) {
			el.before(area);
			el.hidden = true;
		} else root.querySelector('.md')!.append(area);
		area.addEventListener('input', () => grow(area));
		area.addEventListener('keydown', (e) => {
			const make = shortcut(e);
			if (make) {
				e.preventDefault();
				runBlock(make);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				committing = closeBlock(true);
			}
		});
		area.addEventListener('focusout', (e) => {
			// The toolbar's table picker can take focus; that isn't leaving the block.
			if ((e.relatedTarget as Element | null)?.closest('.block-tools')) return;
			if (block?.area === area) committing = closeBlock(false);
		});
		block = { area, el, start, end, original };
		grow(area);
		area.focus();
		area.setSelectionRange(area.value.length, area.value.length);
		keyboardFloor = window.visualViewport?.height ?? 0;
	}

	function runBlock(make: Transform) {
		if (!block) return;
		applyToTextarea(block.area, make);
		grow(block.area);
	}

	/** Write the box back over its block (unless the text moved underneath it), then redraw. */
	async function closeBlock(cancel: boolean) {
		const b = block;
		if (!b) return;
		block = null;
		if (!cancel) {
			const adding = !b.el;
			const unchanged = adding ? doc.text.length === b.start : doc.text.slice(b.start, b.end) === b.original;
			if (unchanged && b.area.value !== b.original) {
				doc.change(adding ? appendBlock(doc.text, b.area.value) : replaceBlock(doc.text, b.start, b.end, b.area.value));
			}
		}
		b.area.remove();
		await rerender();
	}

	async function addTable() {
		unlockFeedback();
		tick();
		await committing;
		doc.change(appendBlock(doc.text, serializeTable({ head: ['Col 1', 'Col 2'], align: [null, null], rows: [['', '']] })));
		await rerender();
		const first = cellAt(tables().length - 1, 1, 0);
		if (first) startEdit(first);
	}

	async function addBlock() {
		unlockFeedback();
		await committing;
		if (!block) openBlock(null);
	}

	async function onclick(ev: MouseEvent) {
		const target = ev.target as HTMLElement;
		if (target instanceof HTMLInputElement && target.classList.contains('task')) {
			ev.preventDefault();
			unlockFeedback();
			tick();
			doc.change(toggleTask(doc.text, Number(target.dataset.task)));
			return;
		}
		if (write && target.closest('a') && !(ev.ctrlKey || ev.metaKey)) ev.preventDefault(); // Ctrl/Cmd-click still follows the link
		if (write && !target.closest('.block-box, table[data-src]')) {
			const el = target.closest<HTMLElement>('[data-block]');
			if (el && !(ev.ctrlKey || ev.metaKey)) {
				// Remember it by position: committing an open block redraws everything.
				const index = blockEls().indexOf(el);
				await committing;
				const fresh = blockEls()[index];
				if (fresh && !block) openBlock(fresh);
				return;
			}
		}
		const cell = target.closest<HTMLElement>('table[data-src] th, table[data-src] td');
		if (!cell || cell === editing?.cell) return;
		// Remember the cell by position: committing the previous cell redraws everything.
		const at = { table: tables().indexOf(cell.closest('table')!), row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
		if (editing) commitNow(null);
		await committing;
		const fresh = cellAt(at.table, at.row, at.col);
		if (fresh) startEdit(fresh);
	}

	function onkeydown(ev: KeyboardEvent) {
		if (!editing) return;
		if (ev.key === 'Tab') {
			ev.preventDefault();
			commitNow(ev.shiftKey ? 'prev' : 'next');
		} else if (ev.key === 'Enter' && !ev.shiftKey) {
			ev.preventDefault();
			commitNow('down');
		} else if (ev.key === 'Escape') {
			ev.preventDefault();
			commitNow(null, true);
		}
	}

	function onfocusout(ev: FocusEvent) {
		// Focus moving to the cell bar (COPY, DEL ROW…) or a + button isn't leaving the cell.
		if (editing && ev.target === editing.cell && !(ev.relatedTarget as Element | null)?.closest('.cell-bar, .edge')) commitNow(null);
	}

	/*
	 * Clicking another cell while editing: the mousedown would blur this cell, whose commit redraws the table
	 * before the click lands, so the click would miss. Keep focus here; onclick commits and opens the new cell.
	 */
	function onpointerdown(ev: PointerEvent) {
		const target = ev.target as HTMLElement;
		if (block) {
			// The same for an open block box: commit it now (that redraws everything), then open what was clicked, found by position.
			if (!target.closest('.block-box')) {
				ev.preventDefault();
				const index = blockEls().indexOf(target.closest<HTMLElement>('[data-block]')!);
				block.area.blur();
				if (index >= 0)
					committing.then(() => {
						const fresh = blockEls()[index];
						if (fresh && !block) openBlock(fresh);
					});
			}
			return;
		}
		if (!editing) return;
		const cell = target.closest('table[data-src] th, table[data-src] td');
		if (cell && cell !== editing.cell) ev.preventDefault();
	}

	function onpointerover(ev: PointerEvent) {
		if (ev.pointerType !== 'mouse') return;
		hovered = (ev.target as HTMLElement).closest<HTMLElement>('table[data-src] th, table[data-src] td');
	}

	/*
	 * Android can hide the keyboard (back button) without blurring the cell.
	 * The visible viewport growing back is the sign; treat it as done.
	 */
	let keyboardFloor = 0;
	$effect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		const onresize = () => {
			const open = editing?.cell ?? block?.area;
			if (!open) return;
			keyboardFloor = Math.min(keyboardFloor, vv.height);
			if (vv.height - keyboardFloor > 120) open.blur();
		};
		vv.addEventListener('resize', onresize);
		return () => vv.removeEventListener('resize', onresize);
	});

	/** Where the floating bar and + buttons go, relative to the viewer. */
	const barCell = $derived(editing?.cell ?? hovered);
	function place(el: Element | null | undefined) {
		if (!el || !root) return null;
		const r = el.getBoundingClientRect();
		const o = root.getBoundingClientRect();
		return { top: r.top - o.top, left: r.left - o.left, width: r.width, height: r.height };
	}
	const barAt = $derived(place(barCell));
	const blockAt = $derived(place(block?.area));
	// Tables are display:block (to scroll when wide), so the box is full width; the header row's width is the table's real edge.
	const tableAt = $derived.by(() => {
		const table = editing?.cell.closest('table');
		const box = place(table);
		const row = place(table?.rows[0]);
		return box && row ? { ...box, width: row.width } : null;
	});
</script>

<!-- Hover ends when the pointer leaves the whole viewer, not just the text: the COPY bar sits outside .md. -->
<div class="viewer" bind:this={root} role="presentation" onpointerleave={() => (hovered = null)}>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div class="md" class:write {onclick} {onkeydown} {onfocusout} {onpointerdown} {onpointerover}>
		{#key renders}{@html html}{/key}
	</div>

	{#if barAt}
		<div class="cell-bar" style:top="{barAt.top}px" style:left="{barAt.left}px">
			<button type="button" class="chip" onpointerdown={(e) => e.preventDefault()} onclick={copy}>
				{copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Copy failed' : 'Copy'}
			</button>
			{#if editing}
				{#if editing.row > 0}
					<button type="button" class="chip ghost" onpointerdown={(e) => e.preventDefault()} onclick={() => changeTable((t, e) => removeRow(t, e.row))}>Del row</button>
				{/if}
				<button type="button" class="chip ghost" onpointerdown={(e) => e.preventDefault()} onclick={() => changeTable((t, e) => removeColumn(t, e.col))}>Del col</button>
			{/if}
		</div>
	{/if}

	{#if block && blockAt}
		<!-- Pressing anywhere on the bar (even between buttons) mustn't take focus from the box. -->
		<div
			class="block-tools"
			role="presentation"
			style:top="{blockAt.top}px"
			style:left="{blockAt.left}px"
			style:width="{blockAt.width}px"
			onpointerdown={(e) => e.preventDefault()}
		>
			<Toolbar run={runBlock} />
		</div>
	{/if}

	{#if write}
		<div class="add">
			<button type="button" class="write-here" onclick={addBlock}>+ Write here</button>
			<button type="button" class="chip" onclick={addTable}>+ Table</button>
		</div>
	{/if}

	{#if editing && tableAt}
		<button
			type="button"
			class="edge circle"
			aria-label="Add row"
			style:top="{tableAt.top + tableAt.height + 4}px"
			style:left="{tableAt.left}px"
			onpointerdown={(e) => e.preventDefault()}
			onclick={() => changeTable((t, e) => addRow(t, e.row + 1))}>+</button
		>
		<button
			type="button"
			class="edge circle"
			aria-label="Add column"
			style:top="{tableAt.top}px"
			style:left="{tableAt.left + tableAt.width + 4}px"
			onpointerdown={(e) => e.preventDefault()}
			onclick={() => changeTable((t, e) => addColumn(t, e.col + 1))}>+</button
		>
	{/if}
</div>

<style>
	.viewer {
		position: relative;
	}
	/* The toolbar sits right on top of the block being edited. */
	.block-tools {
		position: absolute;
		z-index: 6;
		transform: translateY(-100%);
	}
	.add {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 18px;
	}
	.write-here {
		flex: 1;
		text-align: left;
		background: none;
		border: 2px dashed var(--faint);
		color: var(--dim);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 12px;
		cursor: text;
	}
	.write-here:hover {
		border-color: var(--dim);
	}
	/* Sits flush on top of the cell (no gap), so the mouse can travel from the cell to COPY without leaving. */
	.cell-bar {
		position: absolute;
		z-index: 5;
		display: flex;
		gap: 6px;
		transform: translateY(-100%);
	}
	/* The Persona chip: a slanted accent block. */
	.chip {
		font-family: var(--font);
		font-weight: var(--font-weight);
		font-style: var(--font-style);
		text-transform: uppercase;
		font-size: 0.95rem;
		padding: 4px 14px;
		border: 0;
		cursor: pointer;
		background: var(--accent);
		color: var(--accent-ink);
		clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
	}
	.chip.ghost {
		background: var(--ink);
		color: var(--bg);
	}
	.edge {
		position: absolute;
		z-index: 5;
		width: 1.7rem;
		height: 1.7rem;
		background: var(--bg);
	}
</style>
