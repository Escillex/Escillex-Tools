/**
 * Everything secret about sync happens here, on the device.
 *
 * One pairing code (120 random bits, see below) is shared between your
 * devices by QR or by typing it. From it we derive two unrelated values with HKDF:
 *   - mailboxId: sent to the server, names where snapshots are dropped
 *   - key:       AES-GCM key, never leaves the device
 * HKDF is one-way, so knowing the mailbox id tells you nothing about the
 * key or the code.
 */

const SALT = new TextEncoder().encode('escillex-tools sync');
const QR_PREFIX = 'escillex-sync:1:';

/* ---------- base64url helpers (URL-safe, no padding) ---------- */

export function toB64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
	const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
	const raw = atob(b64);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

/* ---------- pairing code ---------- */

/*
 * Pairing codes are made to be typed: 15 random bytes (120 bits) written
 * in Crockford's base32, 24 characters in groups of 4:
 *
 *   K7Q2-9XHM-4P8D-TW3R-ZC6N-HJ5V
 *
 * Only capitals and digits, and no look-alikes (no I, L, O, U), so it's
 * easy to read off a screen. Typing O, I or L still works (read as 0, 1, 1).
 * 120 bits is ~10^36 possible codes: far beyond guessing, especially with
 * the server's rate limit. Older 43-character codes are still accepted.
 */
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 24;

function toBase32(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const b of bytes) {
		value = (value << 8) | b;
		bits += 8;
		while (bits >= 5) {
			out += B32[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	return out;
}

function fromBase32(text: string): Uint8Array<ArrayBuffer> {
	const out: number[] = [];
	let bits = 0;
	let value = 0;
	for (const ch of text) {
		value = (value << 5) | B32.indexOf(ch);
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 255);
			bits -= 8;
		}
	}
	return new Uint8Array(out);
}

/** Uppercase, drop spaces/dashes, fix look-alikes. "k7q2 9xhm-…" → "K7Q29XHM…" */
export function normalizeCode(text: string): string {
	return text
		.toUpperCase()
		.replace(/[\s-]/g, '')
		.replace(/O/g, '0')
		.replace(/[IL]/g, '1');
}

/** "K7Q29XHM4P8D…" → "K7Q2-9XHM-4P8D-…" */
export const groupCode = (code: string) => code.match(/.{1,4}/g)?.join('-') ?? code;

/** A fresh pairing code (already normalized, without dashes). */
export function newSyncCode(): string {
	return toBase32(crypto.getRandomValues(new Uint8Array(15)));
}

const isNewCode = (c: string) => c.length === CODE_LENGTH && [...c].every((ch) => B32.includes(ch));
const isOldCode = (c: string) => /^[A-Za-z0-9_-]{43}$/.test(c);

/** Returns the code in its stored form if valid, else null. Accepts typed, pasted or scanned text. */
export function parseCode(text: string): string | null {
	const trimmed = text.trim();
	const raw = trimmed.startsWith(QR_PREFIX) ? trimmed.slice(QR_PREFIX.length) : trimmed;
	if (isOldCode(raw)) return raw;
	const code = normalizeCode(raw);
	return isNewCode(code) ? code : null;
}

/** The secret bytes behind a code (both formats). */
function codeBytes(code: string): Uint8Array<ArrayBuffer> {
	return isOldCode(code) ? fromB64url(code) : fromBase32(code);
}

/** What the QR holds. The prefix lets the scanner ignore unrelated QR codes. */
export const codeToQr = (code: string) => QR_PREFIX + code;


/* ---------- key derivation ---------- */

export interface SyncKeys {
	mailboxId: string;
	key: CryptoKey;
}

export async function deriveKeys(code: string): Promise<SyncKeys> {
	const master = await crypto.subtle.importKey('raw', codeBytes(code), 'HKDF', false, ['deriveBits', 'deriveKey']);
	const info = (label: string) => new TextEncoder().encode(`escillex-tools sync ${label} v1`);

	const mailboxBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: info('mailbox') }, master, 256);
	const key = await crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: SALT, info: info('key') },
		master,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
	return { mailboxId: toB64url(new Uint8Array(mailboxBits)), key };
}

/* ---------- sealing snapshots ---------- */

export interface Envelope {
	v: 1;
	iv: string;
	data: string;
}

export async function gzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** JSON → gzip → AES-GCM. Compress first: encrypted data can't be compressed. */
export async function seal(value: unknown, key: CryptoKey): Promise<Envelope> {
	const plain = await gzip(new TextEncoder().encode(JSON.stringify(value)));
	const iv = crypto.getRandomValues(new Uint8Array(12)); // never reuse an IV with the same key
	const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
	return { v: 1, iv: toB64url(iv), data: toB64url(sealed) };
}

/**
 * The reverse. AES-GCM checks a built-in tamper seal: if a single byte was
 * changed, or it was locked with a different key, this throws instead of
 * returning garbage.
 */
export async function open<T>(envelope: Envelope, key: CryptoKey): Promise<T> {
	const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(envelope.iv) }, key, fromB64url(envelope.data));
	const json = new TextDecoder().decode(await gunzip(new Uint8Array(plain)));
	return JSON.parse(json) as T;
}
