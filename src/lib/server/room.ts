/**
 * The sync room's decisions, kept apart from the Durable Object so they can
 * be tested without Cloudflare. See SyncRoom.ts for how they're used.
 *
 * Messages (JSON text over the WebSocket):
 *   room → device   { t: 'peer-joined' }            both devices are here, send now
 *                   { t: 'peer-left' }              the other device went away
 *                   { t: 'snapshot', envelope }     the other device's data, passed through
 *   device → room   { t: 'snapshot', envelope }     my data, for the other device
 *                   { t: 'done' }                   I have what I need, close me
 */
import { MAX_BYTES, isEnvelope } from './sync';

/** Devices that can sync at once. A family can have any number; two at a time. */
export const ROOM_SIZE = 2;

/** WebSocket close codes the client understands. */
export const CLOSE = {
	bad: 4000,
	replaced: 4001,
	busy: 4009,
	rateLimited: 4029
} as const;

export type Admission = { ok: false } | { ok: true; replace: boolean; announce: boolean };

/**
 * Can `device` join a room where `present` are already connected?
 * A device that reconnects replaces its old connection.
 */
export function admit(present: string[], device: string): Admission {
	const others = new Set(present.filter((d) => d !== device));
	if (others.size >= ROOM_SIZE) return { ok: false };
	return { ok: true, replace: present.includes(device), announce: others.size === ROOM_SIZE - 1 };
}

export type Reading = { kind: 'snapshot' } | { kind: 'done' } | { kind: 'bad' };

/** What a device sent us. A snapshot is passed on exactly as received. */
export function readMessage(text: string): Reading {
	// Envelope plus a little room for the wrapper.
	if (text.length > MAX_BYTES + 1024) return { kind: 'bad' };
	let msg: unknown;
	try {
		msg = JSON.parse(text);
	} catch {
		return { kind: 'bad' };
	}
	if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return { kind: 'bad' };
	const m = msg as Record<string, unknown>;
	if (m.t === 'done') return { kind: 'done' };
	if (m.t === 'snapshot' && isEnvelope(m.envelope) && m.envelope.data.length <= MAX_BYTES) return { kind: 'snapshot' };
	return { kind: 'bad' };
}
