/**
 * The Cloudflare Worker's front door. Sync room connections go straight to
 * the room; everything else goes to the SvelteKit app.
 *
 * The SvelteKit adapter can't add a Durable Object to the worker it builds,
 * so scripts/wrap-worker.js moves its worker aside and puts this file in
 * front of it after every build. Not type-checked by svelte-check (it imports
 * a build output); keep the logic in src/lib/server, where it is.
 */
import sveltekit from '../.svelte-kit/cloudflare/sveltekit-worker.js';
import { CLOSE } from './lib/server/room';
import { isDevice, isMailbox } from './lib/server/sync';

export { SyncRoom } from './lib/server/SyncRoom';

interface Env {
	SYNC_ROOM: {
		idFromName(name: string): unknown;
		get(id: unknown): { fetch(request: Request): Promise<Response> };
	};
	SYNC_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

const ROOM = /^\/api\/sync\/room\/([^/]+)$/;

/** Refuse over the WebSocket itself: browsers can't read an HTTP error on a WebSocket. */
function refuse(code: number, reason: string): Response {
	const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
	server.accept();
	server.close(code, reason);
	return new Response(null, { status: 101, webSocket: client });
}

export default {
	async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
		const url = new URL(request.url);
		const match = ROOM.exec(url.pathname);
		if (!match) return sveltekit.fetch(request, env, ctx);

		if (request.headers.get('upgrade') !== 'websocket') return new Response('Sync needs a WebSocket', { status: 426 });
		const mailbox = match[1];
		if (!isMailbox(mailbox) || !isDevice(url.searchParams.get('device'))) return refuse(CLOSE.bad, 'bad id');

		// One check per connection. Calls to the rate limiter are free.
		if (env.SYNC_LIMITER) {
			const { success } = await env.SYNC_LIMITER.limit({ key: request.headers.get('cf-connecting-ip') ?? 'unknown' });
			if (!success) return refuse(CLOSE.rateLimited, 'too many requests');
		}

		return env.SYNC_ROOM.get(env.SYNC_ROOM.idFromName(mailbox)).fetch(request);
	}
};
