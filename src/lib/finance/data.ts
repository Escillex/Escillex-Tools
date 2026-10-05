import { db, type Budget, type SyncFields, type Transaction, type Wallet } from './db';

/* ---------- small helpers ---------- */

export const newId = () => crypto.randomUUID();

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toDateKey(new Date());

/** "12.50" -> 1250. Rounds to the nearest centavo. */
export const toCentavos = (pesos: number) => Math.round(pesos * 100);


/** Stamp a record as changed right now. Every write goes through this. */
const touch = <T extends SyncFields>(record: T): T => ({ ...record, updatedAt: Date.now() });

const alive = <T extends SyncFields>(r: T) => !r.deleted;

/* ---------- reads ---------- */

export async function listWallets(): Promise<Wallet[]> {
	const all = await db.wallets.orderBy('order').toArray();
	return all.filter(alive);
}

/** Balance of every wallet, computed from its transactions. */
export async function walletBalances(): Promise<Record<string, number>> {
	const txs = (await db.transactions.toArray()).filter(alive);
	const out: Record<string, number> = {};
	for (const t of txs) out[t.walletId] = (out[t.walletId] ?? 0) + t.amount;
	return out;
}

/** Every transaction, newest day first; within a day, most recent first. */
export async function listTransactions(limit = 300): Promise<Transaction[]> {
	const all = (await db.transactions.toArray()).filter(alive);
	all.sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1));
	return all.slice(0, limit);
}

/** Every budget period, oldest first. */
export async function listBudgets(): Promise<Budget[]> {
	return (await db.budgets.orderBy('startDate').toArray()).filter(alive);
}

export async function currentBudget(): Promise<Budget | undefined> {
	const all = (await db.budgets.orderBy('startDate').toArray()).filter(alive);
	return all.at(-1);
}

export interface BudgetNumbers {
	/** Left to spend today. */
	allowance: number;
	/** Left for the whole budget period. */
	remaining: number;
}

export interface BudgetSummary {
	budget: Budget;
	day: number; // 1-based day within the period
	endDate: string;
	/** Keyed by wallet id, plus 'all' for the sum. Centavos. */
	byWallet: Record<string, BudgetNumbers>;
}

/** A wallet is exempt from the budget when it gets 0% (or isn't in the split at all). */
export const isInBudget = (budget: Budget, walletId: string) => (budget.split[walletId] ?? 0) > 0;

export const addDays = (key: string, n: number) => {
	const [y, m, d] = key.split('-').map(Number);
	return toDateKey(new Date(y, m - 1, d + n));
};

/**
 * Today's allowance and what's left of the budget, per wallet.
 * Each wallet's share is total × its percent, spread evenly over the days.
 * The daily amount never changes; spending less just leaves more in "remaining".
 */
export async function budgetSummary(): Promise<BudgetSummary | null> {
	const budget = await currentBudget();
	if (!budget) return null;

	const today = todayKey();
	const endDate = addDays(budget.startDate, budget.days - 1);
	const day = Math.round((Date.parse(today) - Date.parse(budget.startDate)) / 864e5) + 1;

	const spending = (await db.transactions.where('date').between(budget.startDate, endDate, true, true).toArray()).filter(
		(t) => alive(t) && t.kind === 'expense' && t.countsTowardBudget
	);

	const byWallet: Record<string, BudgetNumbers> = {};
	const all: BudgetNumbers = { allowance: 0, remaining: 0 };

	for (const [walletId, percent] of Object.entries(budget.split)) {
		if (!isInBudget(budget, walletId)) continue; // exempt wallets aren't part of the plan
		const share = (budget.total * percent) / 100;
		const daily = share / budget.days;
		let spentToday = 0;
		let spentTotal = 0;
		for (const t of spending) {
			if (t.walletId !== walletId) continue;
			spentTotal -= t.amount; // expenses are negative
			if (t.date === today) spentToday -= t.amount;
		}
		const inPeriod = day >= 1 && day <= budget.days;
		const n = {
			allowance: inPeriod ? Math.round(daily - spentToday) : 0,
			remaining: Math.round(share - spentTotal)
		};
		byWallet[walletId] = n;
		all.allowance += n.allowance;
		all.remaining += n.remaining;
	}
	byWallet.all = all;

	return { budget, day, endDate, byWallet };
}

/* ---------- writes ---------- */

export async function createWallet(name: string, color: string, startingBalance = 0): Promise<string> {
	const id = newId();
	const order = await db.wallets.count();
	await db.transaction('rw', db.wallets, db.transactions, async () => {
		await db.wallets.add(touch({ id, name, color, order, deleted: false, updatedAt: 0 }));
		if (startingBalance !== 0) {
			await db.transactions.add(
				touch<Transaction>({
					id: newId(),
					walletId: id,
					amount: startingBalance,
					kind: 'adjustment',
					date: todayKey(),
					note: 'Starting balance',
					countsTowardBudget: false,
					deleted: false,
					updatedAt: 0
				})
			);
		}
	});
	return id;
}

/**
 * Remove a wallet (soft delete, so the removal can sync later). Its
 * transactions stay in history. If it had a budget share, that share is
 * split among the other in-budget wallets in proportion, so the plan
 * still adds up to 100%.
 */
export async function deleteWallet(id: string): Promise<void> {
	await db.transaction('rw', db.wallets, db.budgets, async () => {
		const w = await db.wallets.get(id);
		if (!w) return;
		await db.wallets.put(touch({ ...w, deleted: true }));

		const budget = await currentBudget();
		if (!budget || !(id in budget.split)) return;
		const freed = budget.split[id] ?? 0;
		const split = { ...budget.split };
		delete split[id];

		const inBudget = Object.entries(split).filter(([, p]) => p > 0);
		const othersTotal = inBudget.reduce((s, [, p]) => s + p, 0);
		if (freed > 0 && othersTotal > 0) {
			let given = 0;
			inBudget.forEach(([wid, p], i) => {
				// Last one takes the rounding leftover so it's exactly 100.
				const extra = i === inBudget.length - 1 ? freed - given : Math.round((freed * p) / othersTotal);
				split[wid] = p + extra;
				given += extra;
			});
		}
		await db.budgets.put(touch({ ...budget, split }));
	});
}

/** Set (or clear, with an empty object) a wallet's own colors. */
export async function setWalletTheme(id: string, theme: Wallet['theme']): Promise<void> {
	const w = await db.wallets.get(id);
	if (!w) return;
	const clean = Object.fromEntries(Object.entries(theme ?? {}).filter(([, v]) => !!v));
	await db.wallets.put(touch({ ...w, theme: Object.keys(clean).length ? clean : undefined }));
}

export async function renameWallet(id: string, name: string): Promise<void> {
	const w = await db.wallets.get(id);
	if (w && w.name !== name) await db.wallets.put(touch({ ...w, name }));
}

/**
 * "This wallet actually has ₱X now." Records the difference as an
 * adjustment, so the history still adds up.
 */
export async function setWalletBalance(walletId: string, target: number): Promise<void> {
	const current = (await walletBalances())[walletId] ?? 0;
	const diff = target - current;
	if (diff === 0) return;
	await db.transactions.add(
		touch<Transaction>({
			id: newId(),
			walletId,
			amount: diff,
			kind: 'adjustment',
			date: todayKey(),
			note: 'Balance correction',
			countsTowardBudget: false,
			deleted: false,
			updatedAt: 0
		})
	);
}

export async function logExpense(input: {
	walletId: string;
	amount: number; // positive centavos; stored as negative
	note: string;
	date?: string;
	countsTowardBudget?: boolean;
}): Promise<void> {
	await db.transactions.add(
		touch<Transaction>({
			id: newId(),
			walletId: input.walletId,
			amount: -Math.abs(input.amount),
			kind: 'expense',
			date: input.date ?? todayKey(),
			note: input.note,
			countsTowardBudget: input.countsTowardBudget ?? true,
			deleted: false,
			updatedAt: 0
		})
	);
}

export async function logIncome(input: { walletId: string; amount: number; note?: string; date?: string }): Promise<void> {
	await db.transactions.add(
		touch<Transaction>({
			id: newId(),
			walletId: input.walletId,
			amount: Math.abs(input.amount),
			kind: 'income',
			date: input.date ?? todayKey(),
			note: input.note ?? '',
			countsTowardBudget: false,
			deleted: false,
			updatedAt: 0
		})
	);
}

/** Soft delete: keep the record as a tombstone so sync can pass the delete on. */
export async function deleteTransaction(id: string): Promise<void> {
	const t = await db.transactions.get(id);
	if (t) await db.transactions.put(touch({ ...t, deleted: true }));
}

export async function saveBudget(budget: Omit<Budget, keyof SyncFields> & { id?: string }): Promise<void> {
	await db.budgets.put(touch({ ...budget, id: budget.id ?? newId(), deleted: false, updatedAt: 0 }));
}
