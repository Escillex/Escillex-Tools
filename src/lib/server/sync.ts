/**
 * The sync relay's rules. The server can't read anything it relays (the
 * data is encrypted on the devices), so its whole job is to accept only
 * well-formed ids and envelopes, and refuse everything else.
 *
 * Plain functions with no Cloudflare or SvelteKit imports, so the worker,
 * the room and the tests can all share them.
 */

/** Largest snapshot accepted. Years of expenses fit in far less. */
export const MAX_BYTES = 512 * 1024;

/** A mailbox id is 32 bytes in base64url: exactly 43 of these characters. */
const MAILBOX = /^[A-Za-z0-9_-]{43}$/;
/** Device ids are random UUIDs. */
const DEVICE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** AES-GCM nonce: 12 bytes in base64url = 16 characters. */
const IV = /^[A-Za-z0-9_-]{16}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;

export interface Envelope {
	v: 1;
	iv: string;
	data: string;
}

export const isMailbox = (id: string): boolean => MAILBOX.test(id);
export const isDevice = (id: string | null): id is string => !!id && DEVICE.test(id);

/** Exactly { v: 1, iv, data } with the right shapes, nothing extra. */
export function isEnvelope(value: unknown): value is Envelope {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const e = value as Record<string, unknown>;
	return (
		Object.keys(e).sort().join(',') === 'data,iv,v' &&
		e.v === 1 &&
		typeof e.iv === 'string' &&
		IV.test(e.iv) &&
		typeof e.data === 'string' &&
		e.data.length >= 24 &&
		B64URL.test(e.data)
	);
}
