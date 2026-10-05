/**
 * Types for the Cloudflare bindings in wrangler.jsonc. Server code reads
 * them with `import { env } from 'cloudflare:workers'`; locally the
 * adapter fills them with on-disk fakes.
 */
declare module 'cloudflare:workers' {
	/** The parts of Cloudflare KV the sync relay uses. */
	interface SyncKV {
		get(key: string): Promise<string | null>;
		put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
		list<M = unknown>(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string; metadata?: M }[] }>;
	}

	/** Cloudflare's rate limiting binding. */
	interface RateLimiter {
		limit(options: { key: string }): Promise<{ success: boolean }>;
	}

	export const env: {
		SYNC?: SyncKV;
		SYNC_LIMITER?: RateLimiter;
	};
}
