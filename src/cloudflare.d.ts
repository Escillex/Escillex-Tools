/**
 * Types for the Cloudflare parts the sync room uses. Only what the code
 * touches is declared here, so the rest of the app keeps plain browser types.
 */
declare module 'cloudflare:workers' {
	/** Base class for Durable Objects: one instance per id, with its own WebSockets. */
	export abstract class DurableObject<Env = unknown> {
		protected ctx: DurableObjectState;
		protected env: Env;
		constructor(ctx: DurableObjectState, env: Env);
	}
}

/** The parts of a Durable Object's state the sync room uses (the hibernation WebSocket API). */
interface DurableObjectState {
	acceptWebSocket(ws: WebSocket, tags?: string[]): void;
	getWebSockets(tag?: string): WebSocket[];
	getTags(ws: WebSocket): string[];
}

/** Cloudflare's way to make a WebSocket: one end goes back to the browser, the other stays here. */
declare class WebSocketPair {
	0: WebSocket;
	1: WebSocket;
}

interface WebSocket {
	/** Cloudflare only: start handling a WebSocket without hibernation. */
	accept(): void;
}

interface ResponseInit {
	/** Cloudflare only: the browser's end of a WebSocketPair, sent with a 101 response. */
	webSocket?: WebSocket;
}
