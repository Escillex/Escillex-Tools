/** Download progress: Transformers.js reports per file; the runtime is one more "file". */
export interface Bytes {
	loaded: number;
	total: number;
}

export function sumFiles(files: Record<string, Bytes>): Bytes {
	let loaded = 0;
	let total = 0;
	for (const f of Object.values(files)) {
		loaded += f.loaded;
		total += f.total;
	}
	return { loaded, total };
}

/** One decimal under 10 MB (6.3 MB), whole numbers above (109 MB). */
export function mb(bytes: number): string {
	const v = bytes / 1048576;
	return `${v < 10 ? v.toFixed(1) : Math.round(v)} MB`;
}

export const progressLabel = (p: Bytes) => `${Math.round(p.loaded / 1048576)} / ${Math.round(p.total / 1048576)} MB`;
