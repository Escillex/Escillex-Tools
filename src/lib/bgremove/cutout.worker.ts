/// <reference lib="webworker" />
/**
 * Runs the background-removal model off the main thread. 'load' fetches
 * the runtime (ours, gzipped) and the model (Hugging Face, cached by
 * Transformers.js); 'run' turns one image into a full-size transparent PNG
 * plus a small thumbnail for the history.
 */
import { AutoModel, AutoProcessor, RawImage, env } from '@huggingface/transformers';
import { ORT_VERSION, RUNTIME } from './ort.generated';
import { ImageError, classify, type FromWorker, type ToWorker } from './protocol';
import { RUNTIME_CACHE, gunzipIfNeeded, runtimeProgress, type Variant } from './runtime';
import type { ModelSpec } from './models';
import type { Bytes } from './progress';

env.allowLocalModels = false;
// We hand the runtime over ourselves (unzipped); stop Transformers.js fetching it from jsDelivr.
env.useWasmCache = false;

const files: Record<string, Bytes> = {};
const post = (m: FromWorker) => postMessage(m);

/** Read a response while reporting bytes as the 'runtime' file. */
async function readWithProgress(res: Response, gzBytes: number, rawBytes: number): Promise<ArrayBuffer> {
	const unzipped = !!res.headers.get('content-encoding');
	const reader = res.body!.getReader();
	const chunks: Uint8Array<ArrayBuffer>[] = [];
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		received += value.length;
		files.runtime = runtimeProgress(received, gzBytes, rawBytes, unzipped);
		post({ type: 'progress', files });
	}
	return new Blob(chunks).arrayBuffer();
}

/** From our cache, or downloaded once and cached. Older runtime versions are dropped. */
async function cached(url: string, progress?: { gzBytes: number; rawBytes: number }): Promise<ArrayBuffer> {
	const cache = await caches.open(RUNTIME_CACHE);
	const hit = await cache.match(url);
	if (hit) return hit.arrayBuffer();
	const res = await fetch(url);
	if (!res.ok) throw new Error(`network: runtime ${res.status}`);
	const bytes = progress ? await readWithProgress(res, progress.gzBytes, progress.rawBytes) : await res.arrayBuffer();
	await cache.put(url, new Response(bytes));
	for (const req of await cache.keys()) if (!req.url.includes(`/ort/${ORT_VERSION}/`)) await cache.delete(req);
	return bytes;
}

async function setupRuntime(variant: Variant) {
	const r = RUNTIME[variant];
	const [gz, mjs] = await Promise.all([cached(r.wasm, { gzBytes: r.bytes, rawBytes: r.rawBytes }), cached(r.mjs)]);
	const ort = env.backends.onnx as unknown as { wasm: { wasmBinary?: ArrayBuffer; wasmPaths?: unknown; proxy?: boolean } };
	ort.wasm.wasmBinary = await gunzipIfNeeded(gz);
	// The runtime's JS half is imported from a blob URL so it works offline too.
	ort.wasm.wasmPaths = { mjs: URL.createObjectURL(new Blob([mjs], { type: 'text/javascript' })), wasm: r.wasm };
	ort.wasm.proxy = false;
}

let spec: ModelSpec | null = null;
// Transformers.js's model/processor types are too general to be useful here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let model: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;

async function load(next: ModelSpec, device: 'webgpu' | 'wasm', variant: Variant, cached: boolean) {
	await setupRuntime(variant);
	const progress_callback = (p: { status: string; files?: Record<string, Bytes> }) => {
		if (cached || p.status !== 'progress_total' || !p.files) return;
		Object.assign(files, p.files);
		post({ type: 'progress', files });
	};
	model = await AutoModel.from_pretrained(next.repo, {
		revision: next.revision,
		dtype: next.dtype,
		device,
		progress_callback,
		...(next.fileName ? { model_file_name: next.fileName } : {}),
		...(next.custom ? { config: { model_type: 'custom' } } : {})
	} as never);
	processor = await AutoProcessor.from_pretrained(next.repo, { revision: next.revision } as never);
	spec = next;
}

async function run(blob: Blob) {
	if (!spec || !model || !processor) throw new Error('model not loaded');
	let image: RawImage;
	try {
		image = (await RawImage.fromBlob(blob)).rgba();
	} catch (e) {
		throw new ImageError(String(e));
	}
	const { pixel_values } = await processor(image);
	const out = await model({ [spec.input]: pixel_values });
	let scores = (out[spec.output] ?? Object.values(out)[0])[0];
	if (spec.sigmoid) scores = scores.sigmoid();
	// The mask comes out at the model's size (512–1024 px); stretch it to the photo, keep the photo as-is.
	const mask = await RawImage.fromTensor(scores.mul(255).to('uint8')).resize(image.width, image.height);
	image.putAlpha(mask);
	const png: Blob = await image.toBlob('image/png');
	const scale = Math.min(1, 256 / Math.max(image.width, image.height));
	const small = await image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
	const thumb: Blob = await small.toBlob('image/png');
	return { png, thumb };
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
	const m = e.data;
	try {
		if (m.type === 'load') {
			await load(m.spec, m.device, m.variant, m.cached);
			post({ type: 'ready' });
		} else {
			post({ type: 'done', ...(await run(m.image)) });
		}
	} catch (err) {
		post({ type: 'error', kind: classify(err), message: String(err) });
	}
};
