/**
 * Markdown → HTML, plus the "source map" that makes in-place editing
 * possible: top-level tables and checklist boxes carry the character
 * offsets they came from, so an edit can be written back to exactly that
 * spot in the text.
 *
 * Raw HTML is off: a file someone hands you can't run scripts here.
 */
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true });

export function lineStarts(text: string): number[] {
	const starts = [0];
	for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
	return starts;
}

/** `- [ ] `, `1. [x] `, `> * [X] `: where the box's bracket is on its line. */
const TASK_LINE = /^(?:[ \t]*>)*[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[([ xX])\]/;

/** Top-level block openers (and self-contained blocks) that Write mode edits whole. */
const BLOCKS = new Set(['paragraph_open', 'heading_open', 'bullet_list_open', 'ordered_list_open', 'blockquote_open', 'fence', 'code_block', 'hr']);

md.core.ruler.push('source_positions', (state) => {
	const text = state.src;
	const starts = lineStarts(text);
	const offset = (line: number) => (line < starts.length ? starts[line] : text.length);
	/** A block's lines as "start:end", without trailing newlines (the last line's, or blank lines after a loose list). */
	const span = (map: [number, number]) => {
		const start = offset(map[0]);
		let end = offset(map[1]);
		while (end > start && text[end - 1] === '\n') end--;
		return `${start}:${end}`;
	};
	const tokens = state.tokens;
	let row = -1;
	let col = 0;
	let inEditable = false;

	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];

		if (t.type === 'table_open') {
			// Only top-level tables: rebuilding one inside a quote or list would lose its prefix.
			inEditable = t.level === 0 && !!t.map;
			if (inEditable && t.map) t.attrSet('data-src', span(t.map));
			row = -1;
		} else if (t.type === 'table_close') inEditable = false;
		else if (t.type === 'tr_open') {
			row++;
			col = 0;
		} else if ((t.type === 'th_open' || t.type === 'td_open') && inEditable) {
			t.attrSet('data-row', String(row));
			t.attrSet('data-col', String(col++));
		}

		// Write mode: every other top-level block can be edited whole (tables have their own cell editing).
		if (t.level === 0 && t.map && BLOCKS.has(t.type)) t.attrSet('data-block', span(t.map));

		// A list item's text starting with [ ] / [x]: swap the brackets for a real checkbox.
		if (t.type === 'inline' && t.map && tokens[i - 1]?.type === 'paragraph_open' && tokens[i - 2]?.type === 'list_item_open') {
			const first = t.children?.[0];
			const box = /^\[([ xX])\] /.exec(first?.content ?? '');
			const lineText = text.slice(offset(t.map[0]), offset(t.map[0] + 1));
			const onLine = TASK_LINE.exec(lineText);
			if (first && first.type === 'text' && box && onLine) {
				const at = offset(t.map[0]) + onLine[0].length - 2; // the char between [ and ]
				first.content = first.content.slice(4);
				const input = new state.Token('html_inline', '', 0);
				const checked = box[1] !== ' ' ? ' checked' : '';
				input.content = `<input type="checkbox" class="task" data-task="${at}"${checked}> `;
				t.children!.unshift(input);
				tokens[i - 2].attrJoin('class', 'task-item');
			}
		}
	}
});

md.renderer.rules.heading_open = (tokens, i, options, _env, self) => {
	if (tokens[i].tag === 'h1') tokens[i].attrJoin('class', 'display title-bar');
	return self.renderToken(tokens, i, options);
};

md.renderer.rules.link_open = (tokens, i, options, _env, self) => {
	tokens[i].attrSet('target', '_blank');
	tokens[i].attrSet('rel', 'noopener noreferrer');
	return self.renderToken(tokens, i, options);
};

export function renderMarkdown(text: string): string {
	return md.render(text);
}
