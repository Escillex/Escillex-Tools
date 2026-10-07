/**
 * File bytes ↔ editor text. The editor always works with LF line endings;
 * the file keeps whatever it had (Windows files are often CRLF) and its
 * BOM, so saving an unchanged file doesn't rewrite every line in git.
 */
export type Eol = '\n' | '\r\n';

export interface Decoded {
	text: string;
	eol: Eol;
	bom: boolean;
	/**
	 * False when the bytes aren't valid UTF-8 (an old Windows-1252 file, say).
	 * The text is still shown, with unreadable characters as �, but saving it
	 * would write those � back over the originals, so Yellowpad won't save.
	 */
	utf8: boolean;
}

export function decode(bytes: Uint8Array): Decoded {
	const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
	const body = bom ? bytes.subarray(3) : bytes;
	let raw: string;
	let utf8 = true;
	try {
		raw = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }).decode(body);
	} catch {
		raw = new TextDecoder('utf-8', { ignoreBOM: true }).decode(body);
		utf8 = false;
	}
	const crlf = raw.match(/\r\n/g)?.length ?? 0;
	const lf = (raw.match(/\n/g)?.length ?? 0) - crlf;
	return { text: raw.replace(/\r\n/g, '\n'), eol: crlf > lf ? '\r\n' : '\n', bom, utf8 };
}

export function encode(text: string, eol: Eol, bom: boolean): Uint8Array<ArrayBuffer> {
	const body = new TextEncoder().encode(eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
	if (!bom) return body;
	const out = new Uint8Array(body.length + 3);
	out.set([0xef, 0xbb, 0xbf]);
	out.set(body, 3);
	return out;
}
