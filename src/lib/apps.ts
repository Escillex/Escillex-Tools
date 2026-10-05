/**
 * Every tool in the suite. The launcher and "Sync all" read from this
 * list, so adding a tool starts here.
 */
import type { Table } from 'dexie';
import type { SyncFields } from '#lib/finance/db.ts';
import { db as financeDb } from '#lib/finance/db.ts';

export interface ToolInfo {
	id: string;
	name: string;
	href: string;
	/** The tables "Sync all" copies between devices. Every record needs id/updatedAt/deleted. */
	syncTables: Record<string, Table<SyncFields, string>>;
}

export const tools: ToolInfo[] = [
	{
		id: 'finance',
		name: 'Wallet',
		href: '/wallet',
		syncTables: {
			wallets: financeDb.wallets as unknown as Table<SyncFields, string>,
			transactions: financeDb.transactions as unknown as Table<SyncFields, string>,
			budgets: financeDb.budgets as unknown as Table<SyncFields, string>
		}
	}
];
