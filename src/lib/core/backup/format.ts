/**
 * The .escb backup file: password-encrypted, with its own signature.
 *
 *   bytes  0-3   "ESCB"          signature, so we never try to read other files
 *   byte   4     version (1)
 *   byte   5     key method (1 = PBKDF2-SHA256)
 *   bytes  6-9   PBKDF2 rounds   (big-endian)
 *   bytes 10-25  salt            (16 random bytes, new for every file)
 *   bytes 26-37  IV              (12 random bytes)
 *   bytes 38-…   AES-GCM( gzip( JSON snapshot ) )
 *
 * The 38-byte header is also passed to AES-GCM as "additional data": it
 * isn't encrypted, but it's covered by the tamper seal, so changing even
 * the round count makes the whole file refuse to open.
 */
import { gzip, gunzip } from '#lib/core/sync/crypto.ts';

export const EXTENSION = '.escb';
export const MIME = 'application/x-escillex-backup';

const MAGIC = [0x45, 0x53, 0x43, 0x42]; // "ESCB"
const VERSION = 1;
const KDF_PBKDF2_SHA256 = 1;
/** Deliberately slow: each password guess costs an attacker this much work. */
const ROUNDS = 600_000;
const HEADER_LENGTH = 38;

export class BackupError extends Error {
	constructor(
		message: string,
		public kind: 'not-a-backup' | 'newer-version' | 'wrong-password'
	) {
		super(message);
	}
}

async function keyFromPassword(password: string, salt: Uint8Array<ArrayBuffer>, rounds: number): Promise<CryptoKey> {
	const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds },
		base,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/** Lock any JSON-able value into a .escb file's bytes. */
export async function encodeBackup(value: unknown, password: string): Promise<Blob> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const iv = crypto.getRandomValues(new Uint8Array(12));

	const header = new Uint8Array(HEADER_LENGTH);
	header.set(MAGIC, 0);
	header[4] = VERSION;
	header[5] = KDF_PBKDF2_SHA256;
	new DataView(header.buffer).setUint32(6, ROUNDS);
	header.set(salt, 10);
	header.set(iv, 26);

	const key = await keyFromPassword(password, salt, ROUNDS);
	const plain = await gzip(new TextEncoder().encode(JSON.stringify(value)));
	const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header }, key, plain);
	return new Blob([header, sealed], { type: MIME });
}

/** Check the signature without a password (so we can say "not a backup" right away). */
export function looksLikeBackup(bytes: Uint8Array): boolean {
	return bytes.length > HEADER_LENGTH && MAGIC.every((b, i) => bytes[i] === b);
}

/** Unlock a .escb file. Throws BackupError with a kind the UI can explain. */
export async function decodeBackup<T>(bytes: Uint8Array<ArrayBuffer>, password: string): Promise<T> {
	if (!looksLikeBackup(bytes)) throw new BackupError("This file isn't a Tools backup.", 'not-a-backup');
	if (bytes[4] !== VERSION || bytes[5] !== KDF_PBKDF2_SHA256) {
		throw new BackupError('This backup was made by a newer version of the app. Update the app and try again.', 'newer-version');
	}
	const header = bytes.slice(0, HEADER_LENGTH);
	const rounds = new DataView(header.buffer).getUint32(6);
	const salt = header.slice(10, 26);
	const iv = header.slice(26, 38);

	const key = await keyFromPassword(password, salt, rounds);
	let plain: ArrayBuffer;
	try {
		plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: header }, key, bytes.slice(HEADER_LENGTH));
	} catch {
		// AES-GCM can't tell "wrong password" from "damaged file"; wrong password is far more likely.
		throw new BackupError("Wrong password, or the file is damaged.", 'wrong-password');
	}
	return JSON.parse(new TextDecoder().decode(await gunzip(new Uint8Array(plain)))) as T;
}

/** "escillex-backup-2026-10-05.escb" */
export function backupFileName(date = new Date()): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `escillex-backup-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}${EXTENSION}`;
}
