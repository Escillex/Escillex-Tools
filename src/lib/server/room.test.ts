import { describe, expect, it } from 'vitest';
import { admit, readMessage } from './room';
import { MAX_BYTES, isDevice, isMailbox } from './sync';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const envelope = { v: 1, iv: 'AAAAAAAAAAAAAAAA', data: 'A'.repeat(40) };
const snapshot = (env: unknown = envelope) => JSON.stringify({ t: 'snapshot', envelope: env });

describe('admit', () => {
	it('lets the first device in quietly', () => {
		expect(admit([], A)).toEqual({ ok: true, replace: false, announce: false });
	});

	it('announces when the second device arrives', () => {
		expect(admit([A], B)).toEqual({ ok: true, replace: false, announce: true });
	});

	it('turns a third device away', () => {
		expect(admit([A, B], C)).toEqual({ ok: false });
	});

	it('replaces a device that reconnects while alone', () => {
		expect(admit([A], A)).toEqual({ ok: true, replace: true, announce: false });
	});

	it('replaces a device that reconnects mid-sync, and re-announces', () => {
		expect(admit([A, B], A)).toEqual({ ok: true, replace: true, announce: true });
	});
});

describe('readMessage', () => {
	it('forwards a well-formed snapshot', () => {
		expect(readMessage(snapshot())).toEqual({ kind: 'snapshot' });
	});

	it('accepts done', () => {
		expect(readMessage('{"t":"done"}')).toEqual({ kind: 'done' });
	});

	it.each([
		['not JSON', 'nope'],
		['unknown type', '{"t":"hello"}'],
		['an array', '[]'],
		['an envelope with extra keys', snapshot({ ...envelope, extra: 1 })],
		['a bad nonce', snapshot({ ...envelope, iv: 'short' })],
		['a wrong version', snapshot({ ...envelope, v: 2 })],
		['data that is too short', snapshot({ ...envelope, data: 'AAAA' })],
		['data with non-base64url characters', snapshot({ ...envelope, data: '+'.repeat(40) })],
		['a message that is too big', snapshot({ ...envelope, data: 'A'.repeat(MAX_BYTES + 1) })]
	])('refuses %s', (_, text) => {
		expect(readMessage(text)).toEqual({ kind: 'bad' });
	});
});

describe('id checks', () => {
	it('accepts a 43-character mailbox id only', () => {
		expect(isMailbox('a'.repeat(43))).toBe(true);
		expect(isMailbox('a'.repeat(42))).toBe(false);
		expect(isMailbox('a'.repeat(42) + '/')).toBe(false);
	});

	it('accepts a UUID device id only', () => {
		expect(isDevice(A)).toBe(true);
		expect(isDevice('not-a-uuid')).toBe(false);
		expect(isDevice(null)).toBe(false);
	});
});
