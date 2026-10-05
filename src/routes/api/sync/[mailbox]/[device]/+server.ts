/**
 * PUT /api/sync/<mailbox>/<device>
 * Drop this device's encrypted snapshot into the mailbox for 10 minutes.
 */
import type { RequestHandler } from './$types';
import { MAX_BYTES, MAX_DEVICES, TTL_SECONDS, checkDevice, checkMailbox, keyFor, kv, parseEnvelope, prefixFor, rateLimit } from '#lib/server/sync.ts';
import { error, json } from '@sveltejs/kit';

// This runs on the server for every request; never build it ahead of time.
export const prerender = false;

export const PUT: RequestHandler = async ({ params, request, getClientAddress }) => {
	await rateLimit(getClientAddress());
	checkMailbox(params.mailbox);
	checkDevice(params.device);

	// Check the size before reading the whole body, then again after.
	const declared = Number(request.headers.get('content-length') ?? 0);
	if (declared > MAX_BYTES) error(413, 'Too large');
	const text = await request.text();
	if (text.length > MAX_BYTES) error(413, 'Too large');

	const envelope = parseEnvelope(text);
	const store = kv();

	// Cap how many devices can share one mailbox.
	const existing = await store.list({ prefix: prefixFor(params.mailbox), limit: MAX_DEVICES + 1 });
	const others = existing.keys.filter((k) => k.name !== keyFor(params.mailbox, params.device));
	if (others.length >= MAX_DEVICES) error(409, 'This mailbox is full');

	// Stamp with the server's clock, so devices with wrong clocks still agree on "how fresh".
	const at = Date.now();
	await store.put(keyFor(params.mailbox, params.device), JSON.stringify(envelope), {
		expirationTtl: TTL_SECONDS,
		metadata: { at }
	});
	return json({ at });
};
