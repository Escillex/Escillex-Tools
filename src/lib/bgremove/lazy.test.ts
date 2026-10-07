import { describe, expect, it } from 'vitest';
import { isLazy, samePath, swCachesLazily } from './lazy';

describe('lazy paths', () => {
	it('keeps the runtime and worker chunks out of the install download', () => {
		expect(isLazy('/ort/1.31.0/ort-wasm-simd-threaded.asyncify.wasm.gz')).toBe(true);
		expect(isLazy('/_app/immutable/workers/cutout.worker-abc.js')).toBe(true);
		expect(isLazy('/_app/immutable/chunks/app-abc.js')).toBe(false);
		expect(isLazy('/icon-192.png')).toBe(false);
	});
	it('the service worker caches worker chunks itself; the runtime is cached by the BG worker', () => {
		expect(swCachesLazily('/_app/immutable/workers/cutout.worker-abc.js')).toBe(true);
		expect(swCachesLazily('/ort/1.31.0/x.wasm.gz')).toBe(false);
	});
});

describe('manifest paths (SvelteKit lists them without a leading slash)', () => {
	it('still recognises lazy files', () => {
		expect(isLazy('ort/1.31.0/ort-wasm-simd-threaded.asyncify.wasm.gz')).toBe(true);
		expect(isLazy('_app/immutable/workers/cutout.worker-abc.js')).toBe(true);
		expect(isLazy('_app/immutable/chunks/app-abc.js')).toBe(false);
	});
	it('matches a request path against a manifest path', () => {
		expect(samePath('/_app/immutable/workers/a.js', '_app/immutable/workers/a.js')).toBe(true);
		expect(samePath('/_app/immutable/workers/a.js', '/_app/immutable/workers/a.js')).toBe(true);
		expect(samePath('/_app/immutable/workers/a.js', '_app/immutable/workers/b.js')).toBe(false);
	});
});
