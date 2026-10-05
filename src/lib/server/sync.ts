/**
 * The sync relay's rules. The server can't read anything it stores (the
 * data is encrypted on the devices), so its whole job is to accept only
 * well-formed envelopes, keep them briefly, and refuse everything else.
 */
import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';

/** How long a snapshot waits in the mailbox: 10 minutes. */
export const TTL_SECONDS = 600;
/** Largest upload accepted. Years of expenses fit in far less. */
export const MAX_BYTES = 512 * 1024;
/** Most devices one mailbox can hold at once. */
export const MAX_DEVICES = 8;

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

export const keyFor = (mailbox: string, device: string) => `m:${mailbox}:${device}`;
export const prefixFor = (mailbox: string) => `m:${mailbox}:`;

export function checkMailbox(mailbox: string): void {
	if (!MAILBOX.test(mailbox)) error(400, 'Bad mailbox id');
}

export function checkDevice(device: string | null): asserts device is string {
	if (!device || !DEVICE.test(device)) error(400, 'Bad device id');
}

/** Exactly { v: 1, iv, data } with the right shapes, nothing extra. */
export function parseEnvelope(text: string): Envelope {
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		error(400, 'Not JSON');
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) error(400, 'Bad envelope');
	const e = body as Record<string, unknown>;
	const keys = Object.keys(e).sort().join(',');
	if (
		keys !== 'data,iv,v' ||
		e.v !== 1 ||
		typeof e.iv !== 'string' ||
		!IV.test(e.iv) ||
		typeof e.data !== 'string' ||
		e.data.length < 24 ||
		!B64URL.test(e.data)
	) {
		error(400, 'Bad envelope');
	}
	return { v: 1, iv: e.iv, data: e.data };
}

/** One shared limit per IP address across all sync calls. */
export async function rateLimit(ip: string): Promise<void> {
	const limiter = env.SYNC_LIMITER;
	if (!limiter) return; // not configured (e.g. some local setups): skip
	const { success } = await limiter.limit({ key: ip });
	if (!success) error(429, 'Too many requests. Wait a minute and try again.');
}

export function kv() {
	const store = env.SYNC;
	if (!store) error(503, 'Sync storage is not set up');
	return store;
}
