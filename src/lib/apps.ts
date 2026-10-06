/**
 * Every tool in the suite. The launcher and "Sync all" read from this
 * list, so adding a tool starts here.
 */
import type { Table } from 'dexie';
import type { SyncFields } from '#lib/finance/db.ts';
import { db as financeDb } from '#lib/finance/db.ts';
import { readerStatus, walletStatus } from '#lib/launcher/status.ts';

export interface ToolInfo {
	id: string;
	name: string;
	href: string;
	/** The tables "Sync all" copies between devices. Every record needs id/updatedAt/deleted. */
	syncTables: Record<string, Table<SyncFields, string>>;
	/** One short line for the launcher dial, read from this device only. null = nothing to say. */
	status?: () => Promise<string | null>;
}

export const tools: ToolInfo[] = [
	{
		id: 'finance',
		name: 'Wallet',
		href: '/wallet',
		status: walletStatus,
		syncTables: {
			wallets: financeDb.wallets as unknown as Table<SyncFields, string>,
			transactions: financeDb.transactions as unknown as Table<SyncFields, string>,
			budgets: financeDb.budgets as unknown as Table<SyncFields, string>
		}
	},
	{
		id: 'reader',
		name: 'Reader',
		href: '/md',
		status: readerStatus,
		// Files live on disk, not in the app, so there's nothing to sync.
		syncTables: {}
	}
];
