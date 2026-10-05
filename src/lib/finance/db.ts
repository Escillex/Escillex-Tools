import Dexie, { type EntityTable } from 'dexie';

/**
 * Every record that syncs between devices carries these three fields.
 * - id:        random, so two devices never pick the same one
 * - updatedAt: when it last changed (ms since epoch); the newer copy wins on merge
 * - deleted:   a tombstone, so a delete on one device reaches the other
 */
export interface SyncFields {
	id: string;
	updatedAt: number;
	deleted: boolean;
}

export interface Wallet extends SyncFields {
	name: string;
	color: string;
	order: number;
}

/**
 * All money movement is a transaction. A wallet's balance is never stored;
 * it's the sum of its transactions. Amounts are integer centavos
 * (₱12.50 = 1250), negative for money out.
 */
export interface Transaction extends SyncFields {
	walletId: string;
	amount: number;
	kind: 'expense' | 'income' | 'adjustment';
	date: string; // YYYY-MM-DD, the day it happened
	note: string;
	countsTowardBudget: boolean;
}

export interface Budget extends SyncFields {
	total: number; // centavos
	startDate: string; // YYYY-MM-DD
	days: number;
	split: Record<string, number>; // walletId -> percent (adds up to 100)
}

export const db = new Dexie('finance') as Dexie & {
	wallets: EntityTable<Wallet, 'id'>;
	transactions: EntityTable<Transaction, 'id'>;
	budgets: EntityTable<Budget, 'id'>;
};

// First item is the primary key; the rest are indexes we can query by.
// Bump the version number whenever this schema changes.
db.version(1).stores({
	wallets: 'id, order, updatedAt',
	transactions: 'id, walletId, date, updatedAt',
	budgets: 'id, startDate, updatedAt'
});
