/**
 * Tick or untick a checklist box by flipping the one character between
 * its brackets. Nothing else in the file changes, so this is safe even
 * inside quotes or nested lists.
 */
export function toggleTask(text: string, offset: number): string {
	if (text[offset - 1] !== '[' || text[offset + 1] !== ']') return text;
	const c = text[offset];
	const next = c === ' ' ? 'x' : c === 'x' || c === 'X' ? ' ' : null;
	if (next === null) return text;
	return text.slice(0, offset) + next + text.slice(offset + 1);
}
