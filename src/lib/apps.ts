/**
 * Every tool in the suite. The launcher and "Sync all" read from this
 * list, so adding a tool starts here.
 */
import type { Table } from 'dexie';
import type { SyncFields } from '#lib/finance/db.ts';
import { db as financeDb } from '#lib/finance/db.ts';
import { db as fidgetDb } from '#lib/fidget/db.ts';

export interface ToolInfo {
	id: string;
	name: string;
	href: string;
	/** The tables "Sync all" copies between devices. Every record needs id/updatedAt/deleted. */
	syncTables: Record<string, Table<SyncFields, string>>;
	/** Tables that go in the .escb backup but never through live sync (they change too often to push). Same record rules as syncTables. */
	backupTables?: Record<string, Table<SyncFields, string>>;
	/** One short line under the name on the launcher dial: what the tool is for. */
	description: string;
}

export const tools: ToolInfo[] = [
	{
		id: 'finance',
		name: 'Wallet',
		href: '/wallet',
		description: 'DAILY SPENDING · BUDGETS',
		syncTables: {
			wallets: financeDb.wallets as unknown as Table<SyncFields, string>,
			transactions: financeDb.transactions as unknown as Table<SyncFields, string>,
			budgets: financeDb.budgets as unknown as Table<SyncFields, string>
		}
	},
	{
		// The id stays 'reader': settings, the recent-files database and the tool theme are stored under it.
		id: 'reader',
		name: 'Yellowpad',
		href: '/yellowpad',
		description: 'OPEN · READ · EDIT FILES',
		// Files live on disk, not in the app, so there's nothing to sync.
		syncTables: {}
	},
	{
		id: 'bgremove',
		name: 'BG REMOVE',
		href: '/bg-remove',
		description: 'CUT OUT ANY PHOTO',
		// Cutouts can be gigabytes; they stay on each device (a dedicated transfer may come later).
		syncTables: {}
	},
	{
		id: 'fidget',
		name: 'FIDGET',
		href: '/fidget',
		description: 'CLICK · POP · SPIN',
		// Counts change on every press: kept in backups, never pushed through live sync.
		syncTables: {},
		backupTables: {
			counts: fidgetDb.counts as unknown as Table<SyncFields, string>,
			facts: fidgetDb.facts as unknown as Table<SyncFields, string>
		}
	}
];
