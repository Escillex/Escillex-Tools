/**
 * One sync room per pairing code: a Cloudflare Durable Object that two of
 * your devices connect to at the same time. It tells them when they've
 * found each other and passes each one's sealed snapshot to the other. It
 * never stores anything, and it sleeps (costing nothing) between messages.
 *
 * The decisions live in room.ts; this file only wires them to WebSockets.
 */
import { DurableObject } from 'cloudflare:workers';
import { CLOSE, admit, readMessage } from './room';

const PEER_JOINED = JSON.stringify({ t: 'peer-joined' });
const PEER_LEFT = JSON.stringify({ t: 'peer-left' });

/** Sending to a socket that's already closing throws; that's fine, it's leaving anyway. */
function send(ws: WebSocket, text: string): void {
	try {
		ws.send(text);
	} catch {
		// gone
	}
}

export class SyncRoom extends DurableObject {
	/** The worker has already checked the ids and the rate limit. */
	async fetch(request: Request): Promise<Response> {
		const device = new URL(request.url).searchParams.get('device') ?? '';
		const sockets = this.ctx.getWebSockets();
		const verdict = admit(sockets.map((ws) => this.device(ws)), device);
		const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

		if (!verdict.ok) {
			// Answer over the WebSocket: browsers can't read an HTTP error on a WebSocket.
			server.accept();
			server.close(CLOSE.busy, 'busy');
			return new Response(null, { status: 101, webSocket: client });
		}

		if (verdict.replace) {
			for (const ws of sockets) if (this.device(ws) === device) ws.close(CLOSE.replaced, 'replaced');
		}
		this.ctx.acceptWebSocket(server, [device]);
		if (verdict.announce) for (const ws of this.ctx.getWebSockets()) send(ws, PEER_JOINED);

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		const reading = typeof message === 'string' ? readMessage(message) : { kind: 'bad' as const };
		if (reading.kind === 'snapshot') {
			for (const other of this.others(ws)) send(other, message as string);
		} else if (reading.kind === 'done') {
			this.leave(ws);
			ws.close(1000, 'done');
		} else {
			ws.close(CLOSE.bad, 'bad message');
		}
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		this.leave(ws);
	}

	async webSocketError(ws: WebSocket): Promise<void> {
		this.leave(ws);
	}

	private device(ws: WebSocket): string {
		return this.ctx.getTags(ws)[0] ?? '';
	}

	private others(ws: WebSocket): WebSocket[] {
		const me = this.device(ws);
		return this.ctx.getWebSockets().filter((o) => o !== ws && this.device(o) !== me);
	}

	/** Tell the other device this one is gone, unless it's just reconnecting. */
	private leave(ws: WebSocket): void {
		const me = this.device(ws);
		const reconnected = this.ctx.getWebSockets().some((o) => o !== ws && this.device(o) === me);
		if (!reconnected) for (const other of this.others(ws)) send(other, PEER_LEFT);
	}
}
