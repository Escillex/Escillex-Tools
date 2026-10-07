import { describe, expect, it } from 'vitest';
import { decode, encode } from './codec';

const bytes = (s: string) => new TextEncoder().encode(s);
const BOM = [0xef, 0xbb, 0xbf];

describe('decode', () => {
	it('reads an LF file', () => {
		expect(decode(bytes('a\nb\n'))).toEqual({ text: 'a\nb\n', eol: '\n', bom: false, utf8: true });
	});

	it('flags a file that is not UTF-8, so it is never saved back damaged', () => {
		// "café" in Windows-1252: é is the single byte 0xE9, invalid on its own in UTF-8.
		expect(decode(new Uint8Array([0x63, 0x61, 0x66, 0xe9])).utf8).toBe(false);
	});

	it('reads a CRLF file as LF and remembers CRLF', () => {
		expect(decode(bytes('a\r\nb\r\n'))).toEqual({ text: 'a\nb\n', eol: '\r\n', bom: false, utf8: true });
	});

	it('picks the majority for mixed files', () => {
		expect(decode(bytes('a\r\nb\r\nc\n')).eol).toBe('\r\n');
		expect(decode(bytes('a\nb\nc\r\n')).eol).toBe('\n');
	});

	it('strips and remembers a BOM', () => {
		expect(decode(new Uint8Array([...BOM, ...bytes('hi')]))).toEqual({ text: 'hi', eol: '\n', bom: true, utf8: true });
	});

	it('keeps non-ASCII text', () => {
		expect(decode(bytes('₱52 · 😀')).text).toBe('₱52 · 😀');
	});
});

describe('round trip', () => {
	const cases: [string, Uint8Array][] = [
		['LF', bytes('# T\n\n| a |\n| - |\n')],
		['CRLF', bytes('# T\r\n\r\n- [ ] x\r\n')],
		['BOM + CRLF', new Uint8Array([...BOM, ...bytes('a\r\nb')])],
		['empty', new Uint8Array()]
	];
	for (const [name, input] of cases) {
		it(`is byte-identical for ${name}`, () => {
			const d = decode(input);
			expect(encode(d.text, d.eol, d.bom)).toEqual(input);
		});
	}
});
