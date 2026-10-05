/**
 * GET /api/sync/<mailbox>?device=<me>
 * Pick up every *other* device's snapshot waiting in the mailbox.
 */
import type { RequestHandler } from './$types';
import { MAX_DEVICES, checkDevice, checkMailbox, kv, prefixFor, rateLimit } from '#lib/server/sync.ts';
import { json } from '@sveltejs/kit';

export const prerender = false;

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
	await rateLimit(getClientAddress());
	checkMailbox(params.mailbox);
	const me = url.searchParams.get('device');
	checkDevice(me);

	const store = kv();
	const prefix = prefixFor(params.mailbox);
	const { keys } = await store.list<{ at: number }>({ prefix, limit: MAX_DEVICES + 1 });

	const snapshots = [];
	for (const key of keys) {
		const device = key.name.slice(prefix.length);
		if (device === me) continue;
		const value = await store.get(key.name);
		if (value) snapshots.push({ device, at: key.metadata?.at ?? 0, envelope: JSON.parse(value) });
	}

	return json(snapshots, { headers: { 'cache-control': 'no-store' } });
};
