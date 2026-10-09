/**
 * Snapshots and merging.
 *
 * A snapshot is every syncable record from every tool, tombstones
 * included. Merging is per record: for each id, the copy with the newer
 * `updatedAt` wins. Both devices apply the same rule to each other's
 * snapshot, so they end up identical no matter who syncs first.
 * Live sync covers syncTables; a backup file also covers backupTables (see scope.ts).
 */
import { tools } from '#lib/apps.ts';
import type { SyncFields } from '#lib/finance/db.ts';
import { getSetting } from '#lib/core/db.ts';
import { currencyForSync, isCurrency, setCurrency } from '#lib/core/currency.svelte.ts';
import { applyLooks, looksForSync } from '#lib/core/theme.svelte.ts';
import { incomingLooks, outgoingLooks, type Looks } from './looks';
import { tablesFor, type Scope } from './scope';

type Rec = SyncFields & Record<string, unknown>;

/** A synced setting: its value and when it was last changed. */
type Stamped<T> = { value: T; at: number };

export interface Snapshot {
	format: 1;
	deviceId: string;
	at: number;
	/** toolId → table name → records */
	tools: Record<string, Record<string, Rec[]>>;
	/** App-wide settings that follow you across devices. */
	settings?: { currency?: Stamped<string>; looks?: Looks };
}

/** The newest stamped value among several snapshots' settings. */
function newestCurrency(snaps: Snapshot[]): Stamped<string> | null {
	let best: Stamped<string> | null = null;
	for (const s of snaps) {
		const c = s.settings?.currency;
		if (c && isCurrency(c.value) && typeof c.at === 'number' && (!best || c.at > best.at)) best = c;
	}
	return best;
}

export async function buildSnapshot(scope: Scope = 'sync'): Promise<Snapshot> {
	const out: Snapshot['tools'] = {};
	for (const tool of tools) {
		out[tool.id] = {};
		for (const [name, table] of Object.entries(tablesFor(tool, scope))) {
			out[tool.id][name] = (await table.toArray()) as Rec[];
		}
	}
	const currency = await currencyForSync();
	return {
		format: 1,
		deviceId: (await getSetting<string>('deviceId')) ?? 'unknown',
		at: Date.now(),
		tools: out,
		settings: { ...(currency ? { currency } : {}), looks: await looksForSync() }
	};
}

/** Only accept records that look like ours; anything else is ignored. */
const isRec = (r: unknown): r is Rec =>
	typeof r === 'object' &&
	r !== null &&
	typeof (r as Rec).id === 'string' &&
	typeof (r as Rec).updatedAt === 'number' &&
	typeof (r as Rec).deleted === 'boolean';

export interface Counts {
	added: number;
	changed: number;
	deleted: number;
}

export interface Comparison {
	/** What this device would receive. */
	incoming: Counts;
	/** What the other device would receive from us. */
	outgoing: Counts;
	/** Per tool, so the UI can say "Wallet: 3 new". */
	byTool: Record<string, { incoming: Counts; outgoing: Counts }>;
}

const zero = (): Counts => ({ added: 0, changed: 0, deleted: 0 });

function count(target: Counts, rec: Rec, existedBefore: boolean) {
	if (rec.deleted) target.deleted++;
	else if (existedBefore) target.changed++;
	else target.added++;
}

/** Compare our snapshot with one or more from other devices. Nothing is written. */
export function compare(local: Snapshot, remotes: Snapshot[], scope: Scope = 'sync'): Comparison {
	const result: Comparison = { incoming: zero(), outgoing: zero(), byTool: {} };

	for (const tool of tools) {
		const t = (result.byTool[tool.id] = { incoming: zero(), outgoing: zero() });
		for (const table of Object.keys(tablesFor(tool, scope))) {
			const mine = new Map((local.tools[tool.id]?.[table] ?? []).map((r) => [r.id, r]));

			// The newest version of each record across all the other devices.
			const theirs = new Map<string, Rec>();
			for (const remote of remotes) {
				for (const r of remote.tools[tool.id]?.[table] ?? []) {
					if (!isRec(r)) continue;
					const seen = theirs.get(r.id);
					if (!seen || r.updatedAt > seen.updatedAt) theirs.set(r.id, r);
				}
			}

			for (const [id, r] of theirs) {
				const m = mine.get(id);
				if (!m || r.updatedAt > m.updatedAt) {
					count(t.incoming, r, !!m);
					count(result.incoming, r, !!m);
				}
			}
			for (const [id, m] of mine) {
				const r = theirs.get(id);
				if (!r || m.updatedAt > r.updatedAt) {
					count(t.outgoing, m, !!r);
					count(result.outgoing, m, !!r);
				}
			}
		}
	}

	// Settings count as "changed" when one side's choice is newer.
	const mine = local.settings?.currency;
	const theirs = newestCurrency(remotes);
	if (theirs && theirs.value !== mine?.value) {
		if (!mine || theirs.at > mine.at) result.incoming.changed++;
		else result.outgoing.changed++;
	}
	const myLooks = local.settings?.looks ?? {};
	const theirLooks = remotes.map((r) => r.settings?.looks);
	result.incoming.changed += Object.keys(incomingLooks(myLooks, theirLooks)).length;
	result.outgoing.changed += outgoingLooks(myLooks, theirLooks);
	return result;
}

/** A snapshot from a sync or a backup file: is it shaped like ours? */
export function isSnapshot(v: unknown): v is Snapshot {
	return typeof v === 'object' && v !== null && (v as Snapshot).format === 1 && typeof (v as Snapshot).tools === 'object';
}

/**
 * Make this device exactly match a snapshot: every synced table is
 * emptied and refilled from it. Used by "Replace everything" on restore.
 */
export async function replaceWith(snapshot: Snapshot, scope: Scope = 'sync'): Promise<number> {
	let written = 0;
	for (const tool of tools) {
		for (const [name, table] of Object.entries(tablesFor(tool, scope))) {
			const records = (snapshot.tools[tool.id]?.[name] ?? []).filter(isRec);
			await table.db.transaction('rw', table, async () => {
				await table.clear();
				if (records.length) await table.bulkPut(records);
			});
			written += records.length;
		}
	}
	const c = snapshot.settings?.currency;
	if (c && isCurrency(c.value) && typeof c.at === 'number') await setCurrency(c.value, c.at);
	// Restoring a backup takes its look too.
	const looks = incomingLooks({}, [snapshot.settings?.looks]);
	if (Object.keys(looks).length) await applyLooks(looks);
	return written;
}

/**
 * Write the other devices' newer records into our databases. Re-checks
 * against what's stored right now (inside a transaction), so anything
 * you changed while the comparison was on screen isn't overwritten by an
 * older copy.
 */
export async function applyRemotes(remotes: Snapshot[], scope: Scope = 'sync'): Promise<number> {
	let written = 0;
	for (const tool of tools) {
		for (const [name, table] of Object.entries(tablesFor(tool, scope))) {
			const newest = new Map<string, Rec>();
			for (const remote of remotes) {
				for (const r of remote.tools[tool.id]?.[name] ?? []) {
					if (!isRec(r)) continue;
					const seen = newest.get(r.id);
					if (!seen || r.updatedAt > seen.updatedAt) newest.set(r.id, r);
				}
			}
			if (newest.size === 0) continue;

			await table.db.transaction('rw', table, async () => {
				const ids = [...newest.keys()];
				const current = await table.bulkGet(ids);
				const toWrite = ids
					.map((id, i) => ({ incoming: newest.get(id)!, existing: current[i] }))
					.filter(({ incoming, existing }) => !existing || incoming.updatedAt > existing.updatedAt)
					.map(({ incoming }) => incoming);
				if (toWrite.length) await table.bulkPut(toWrite);
				written += toWrite.length;
			});
		}
	}

	// Take the other device's currency if it was chosen more recently.
	// Keep its timestamp, so this device doesn't now look "newer" than it.
	const theirs = newestCurrency(remotes);
	const mine = await currencyForSync();
	if (theirs && isCurrency(theirs.value) && theirs.value !== mine?.value && (!mine || theirs.at > mine.at)) {
		await setCurrency(theirs.value, theirs.at);
		written++;
	}

	// The same for the look (colours, fonts), one setting at a time.
	const looks = incomingLooks(await looksForSync(), remotes.map((r) => r.settings?.looks));
	if (Object.keys(looks).length) {
		await applyLooks(looks);
		written += Object.keys(looks).length;
	}
	return written;
}
