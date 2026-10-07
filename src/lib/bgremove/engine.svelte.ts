/**
 * The page's handle on the cutout worker. One worker, one model at a time:
 * switching models starts a fresh worker (frees the old model's memory).
 * Cancel kills the worker outright, which is the only way to stop a
 * download half-way. Nothing half-downloaded is cached by Transformers.js.
 */
import type { ModelSpec } from './models';
import type { Variant } from './runtime';
import { classify, type FromWorker, type Outcome, type ToWorker } from './protocol';
import { sumFiles, type Bytes } from './progress';

type Reply = FromWorker | { type: 'cancelled' };

export class Engine {
	status = $state<'idle' | 'downloading' | 'working'>('idle');
	progress = $state<Bytes>({ loaded: 0, total: 0 });

	#worker: Worker | null = null;
	#model: string | null = null;
	#expected = 0;
	#settle: ((m: Reply) => void) | null = null;

	#spawn(): Worker {
		const w = new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' });
		w.onmessage = (e: MessageEvent<FromWorker>) => {
			if (e.data.type === 'progress') {
				const sum = sumFiles(e.data.files);
				this.progress = { loaded: sum.loaded, total: Math.max(this.#expected, sum.total) };
			} else this.#settle?.(e.data);
		};
		// A worker that dies (often: out of memory) reports here, not through a message.
		w.onerror = (e) => {
			e.preventDefault();
			this.#settle?.({ type: 'error', kind: classify(e.message), message: e.message });
		};
		return w;
	}

	#ask(msg: ToWorker): Promise<Reply> {
		return new Promise((resolve) => {
			this.#settle = (m) => {
				this.#settle = null;
				resolve(m);
			};
			this.#worker!.postMessage(msg);
		});
	}

	#reset() {
		this.#worker?.terminate();
		this.#worker = null;
		this.#model = null;
	}

	/**
	 * expectedBytes: what still has to download (shown before the first progress report arrives).
	 * cached: the model is already on this device.
	 */
	async cutout(spec: ModelSpec, device: 'webgpu' | 'wasm', variant: Variant, image: Blob, expectedBytes: number, cached: boolean): Promise<Outcome> {
		if (!this.#worker || this.#model !== spec.id) {
			this.#reset();
			this.#worker = this.#spawn();
			this.#expected = expectedBytes;
			this.progress = { loaded: 0, total: expectedBytes };
			this.status = 'downloading';
			const r = await this.#ask({ type: 'load', spec, device, variant, cached });
			if (r.type !== 'ready') {
				if (r.type === 'error') this.#reset();
				this.status = 'idle';
				return r as Outcome;
			}
			this.#model = spec.id;
		}
		this.status = 'working';
		const r = await this.#ask({ type: 'run', image });
		this.status = 'idle';
		// After running out of memory the worker can't be trusted; start fresh next time.
		if (r.type === 'error' && r.kind !== 'image') this.#reset();
		return r as Outcome;
	}

	cancel() {
		this.#reset();
		this.status = 'idle';
		this.#settle?.({ type: 'cancelled' });
	}

	dispose() {
		this.#reset();
	}
}
