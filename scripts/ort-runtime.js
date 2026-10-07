/**
 * Puts the ONNX runtime (the engine BG REMOVE's models run on) into
 * static/ort/<version>/. The WebGPU build's .wasm is ~26 MiB, over
 * Cloudflare's 25 MiB per-file limit, so it ships gzipped (~6 MiB) and the
 * browser unzips it. Also writes src/lib/bgremove/ort.generated.ts so the
 * app knows the URLs and sizes. Runs before dev/build/check; skips the
 * gzip work when this version is already there.
 */
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { constants, createGzip } from 'node:zlib';

// Transformers.js may carry its own copy; that's the one Vite bundles, so check it first.
const dir = ['node_modules/@huggingface/transformers/node_modules/onnxruntime-web', 'node_modules/onnxruntime-web'].find((d) =>
	existsSync(`${d}/package.json`)
);
if (!dir) throw new Error('onnxruntime-web not found: run npm install');

const version = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')).version;
const out = `static/ort/${version}`;
const variants = { asyncify: 'ort-wasm-simd-threaded.asyncify', plain: 'ort-wasm-simd-threaded' };

const ready = Object.values(variants).every((base) => existsSync(`${out}/${base}.wasm.gz`) && existsSync(`${out}/${base}.mjs`));
if (!ready) {
	rmSync('static/ort', { recursive: true, force: true }); // drop older versions
	mkdirSync(out, { recursive: true });
	for (const base of Object.values(variants)) {
		copyFileSync(`${dir}/dist/${base}.mjs`, `${out}/${base}.mjs`);
		await pipeline(
			createReadStream(`${dir}/dist/${base}.wasm`),
			createGzip({ level: constants.Z_BEST_COMPRESSION }),
			createWriteStream(`${out}/${base}.wasm.gz`)
		);
	}
}

const runtime = Object.fromEntries(
	Object.entries(variants).map(([key, base]) => [
		key,
		{
			mjs: `/ort/${version}/${base}.mjs`,
			wasm: `/ort/${version}/${base}.wasm.gz`,
			bytes: statSync(`${out}/${base}.wasm.gz`).size,
			// Unzipped size: for progress when a server unzips it on the way.
			rawBytes: statSync(`${dir}/dist/${base}.wasm`).size
		}
	])
);
mkdirSync('src/lib/bgremove', { recursive: true });
writeFileSync(
	'src/lib/bgremove/ort.generated.ts',
	`// Written by scripts/ort-runtime.js. Do not edit.\nexport const ORT_VERSION = ${JSON.stringify(version)};\nexport const RUNTIME = ${JSON.stringify(runtime, null, '\t')} as const;\n`
);
console.log(`ORT ${version} runtime ready in ${out}`);
