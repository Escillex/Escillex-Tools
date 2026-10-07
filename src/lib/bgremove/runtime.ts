/**
 * The ONNX runtime ships gzipped from our own static files (the raw .wasm
 * is over Cloudflare's 25 MiB limit). These helpers pick which build to
 * load and unzip it in the browser.
 */
export type Variant = 'asyncify' | 'plain';

export const RUNTIME_CACHE = 'bg-runtime';

/** Same rule Transformers.js uses: Safari before 26 can't run the asyncify build without WebGPU. */
export function pickVariant(ua: string, webgpu: boolean): Variant {
	const safari = /Safari\//.test(ua) && !/(Chrome|Chromium|CriOS|Edg|FxiOS|Android)/.test(ua);
	const version = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
	return safari && version > 0 && version < 26 && !webgpu ? 'plain' : 'asyncify';
}

export const isGzip = (b: Uint8Array) => b.length >= 2 && b[0] === 0x1f && b[1] === 0x8b;

/**
 * Download progress for the runtime, in gzipped bytes. If the server sent it
 * with Content-Encoding (the dev server does), the browser unzips on the way
 * and bytes arrive at full size, so scale them back to match the total.
 */
export function runtimeProgress(received: number, gzBytes: number, rawBytes: number, unzipped: boolean) {
	const loaded = unzipped ? Math.round((received * gzBytes) / rawBytes) : received;
	return { loaded: Math.min(loaded, gzBytes), total: gzBytes };
}

/** Unzip, unless something on the way (a proxy, the dev server) already did. */
export async function gunzipIfNeeded(buf: ArrayBuffer): Promise<ArrayBuffer> {
	if (!isGzip(new Uint8Array(buf, 0, Math.min(2, buf.byteLength)))) return buf;
	return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}
