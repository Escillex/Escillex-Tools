/** Messages between the page and the cutout worker, and how errors are sorted for the user. */
import type { ModelSpec } from './models';
import type { Bytes } from './progress';
import type { Variant } from './runtime';

export type ErrorKind = 'memory' | 'network' | 'image' | 'failed';

/** cached: the model is already on this device (reading it back from disk isn't a download, so it isn't reported). */
export type ToWorker = { type: 'load'; spec: ModelSpec; device: 'webgpu' | 'wasm'; variant: Variant; cached: boolean } | { type: 'run'; image: Blob };

export type FromWorker =
	| { type: 'progress'; files: Record<string, Bytes> }
	| { type: 'ready' }
	| { type: 'done'; png: Blob; thumb: Blob }
	| { type: 'error'; kind: ErrorKind; message: string };

export type Outcome = { type: 'done'; png: Blob; thumb: Blob } | { type: 'error'; kind: ErrorKind; message: string } | { type: 'cancelled' };

/** Thrown when the picked file can't be decoded as an image. */
export class ImageError extends Error {}

export function classify(err: unknown): ErrorKind {
	if (err instanceof ImageError) return 'image';
	const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? '');
	if (/memory|allocation|bad_alloc|device lost|\boom\b/i.test(msg)) return 'memory';
	if (/fetch|network/i.test(msg)) return 'network';
	return 'failed';
}
