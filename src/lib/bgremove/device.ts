/** Browser-only lookups: what this device can do, and what's already downloaded. */
import { MODEL_CACHE, belongsTo, type Device, type ModelSpec } from './models';
import { RUNTIME_CACHE } from './runtime';

export async function detectDevice(): Promise<Device> {
	type Adapter = { limits: { maxStorageBuffersPerShaderStage: number } };
	const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<Adapter | null> }; deviceMemory?: number };
	let adapter: Adapter | null = null;
	try {
		adapter = (await nav.gpu?.requestAdapter()) ?? null;
	} catch {
		/* no adapter: treat as no WebGPU */
	}
	return {
		webgpu: !!adapter,
		memoryGB: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
		gpuBuffers: adapter?.limits.maxStorageBuffersPerShaderStage ?? null
	};
}

export async function cachedModelUrls(): Promise<string[]> {
	if (!('caches' in self)) return [];
	return (await (await caches.open(MODEL_CACHE)).keys()).map((r) => r.url);
}

export async function removeModel(m: ModelSpec): Promise<void> {
	const cache = await caches.open(MODEL_CACHE);
	for (const req of await cache.keys()) if (belongsTo(m, req.url)) await cache.delete(req);
}

export async function runtimeCached(wasmUrl: string): Promise<boolean> {
	if (!('caches' in self)) return false;
	return !!(await (await caches.open(RUNTIME_CACHE)).match(wasmUrl));
}
