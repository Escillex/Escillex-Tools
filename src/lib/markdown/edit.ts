/**
 * Applying toolbar transforms to a textarea, shared by the raw editor and
 * Write mode's block box. execCommand is deprecated but still the only way
 * to edit a textarea and keep its native undo (Ctrl+Z undoes a Bold like
 * it undoes typing).
 */
import { insertLink, wrap, type Change, type Sel } from './transforms';

export type Transform = (text: string, sel: Sel) => Change;

export function applyToTextarea(area: HTMLTextAreaElement, make: Transform): void {
	const c = make(area.value, { start: area.selectionStart, end: area.selectionEnd });
	area.focus();
	area.setSelectionRange(c.from, c.to);
	const ok = c.insert === '' ? document.execCommand('delete') : document.execCommand('insertText', false, c.insert);
	if (!ok) {
		area.setRangeText(c.insert, c.from, c.to, 'end');
		area.dispatchEvent(new Event('input', { bubbles: true })); // execCommand fires this itself
	}
	area.setSelectionRange(c.sel.start, c.sel.end);
}

/** Ctrl/⌘ + B, I, K. Returns the transform for a shortcut, or null. */
export function shortcut(e: KeyboardEvent): Transform | null {
	if (!(e.ctrlKey || e.metaKey)) return null;
	const k = e.key.toLowerCase();
	if (k === 'b') return (t, s) => wrap(t, s, '**');
	if (k === 'i') return (t, s) => wrap(t, s, '*');
	if (k === 'k') return insertLink;
	return null;
}
