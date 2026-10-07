import { describe, expect, it } from 'vitest';
import { gunzipIfNeeded, isGzip, pickVariant, runtimeProgress } from './runtime';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const SAFARI_18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const SAFARI_26 = SAFARI_18.replace('Version/18.0', 'Version/26.0');

async function gzip(bytes: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
	return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
}

describe('pickVariant', () => {
	it('uses the asyncify build normally', () => {
		expect(pickVariant(CHROME, false)).toBe('asyncify');
		expect(pickVariant(SAFARI_26, false)).toBe('asyncify');
		expect(pickVariant(SAFARI_18, true)).toBe('asyncify');
	});
	it('uses the plain build on Safari before 26 without WebGPU (asyncify breaks there)', () => {
		expect(pickVariant(SAFARI_18, false)).toBe('plain');
	});
});

describe('gzip', () => {
	it('detects the gzip magic bytes', () => {
		expect(isGzip(new Uint8Array([0x1f, 0x8b, 8]))).toBe(true);
		expect(isGzip(new Uint8Array([0, 0x61, 0x73, 0x6d]))).toBe(false); // "\0asm"
		expect(isGzip(new Uint8Array([]))).toBe(false);
	});
	it('unzips gzip bytes', async () => {
		const raw = new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 2, 3]);
		const out = new Uint8Array(await gunzipIfNeeded(await gzip(raw)));
		expect([...out]).toEqual([...raw]);
	});
	it('passes through bytes something already unzipped', async () => {
		const raw = new Uint8Array([0, 0x61, 0x73, 0x6d, 1]);
		const out = new Uint8Array(await gunzipIfNeeded(raw.buffer));
		expect([...out]).toEqual([...raw]);
	});
});

describe('runtimeProgress', () => {
	const gz = 6_000_000;
	const raw = 24_000_000;
	it('counts gzipped bytes as they arrive', () => {
		expect(runtimeProgress(3_000_000, gz, raw, false)).toEqual({ loaded: 3_000_000, total: gz });
	});
	it('scales back when the server unzipped it on the way (bytes arrive at full size)', () => {
		expect(runtimeProgress(12_000_000, gz, raw, true)).toEqual({ loaded: 3_000_000, total: gz });
		expect(runtimeProgress(raw, gz, raw, true)).toEqual({ loaded: gz, total: gz });
	});
	it('never goes past the total', () => {
		expect(runtimeProgress(gz + 5, gz, raw, false)).toEqual({ loaded: gz, total: gz });
	});
});
