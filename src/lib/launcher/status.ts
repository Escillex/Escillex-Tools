/**
 * The one-line status each tool shows on the launcher dial. Read from
 * this device only (Dexie), once when the launcher opens: no network.
 * The data modules are imported lazily so the formatters stay testable
 * without a database.
 */
import type { BudgetSummary } from '#lib/finance/data.ts';

export function walletLine(summary: BudgetSummary | null, balances: Record<string, number>, fmt: (h: number) => string): string | null {
	const all = summary?.byWallet.all;
	if (all) return `${fmt(all.allowance)} LEFT TODAY`;
	const ids = Object.keys(balances);
	if (!ids.length) return null;
	return `${fmt(ids.reduce((sum, id) => sum + balances[id], 0))} TOTAL`;
}

export const readerLine = (name?: string) => (name ? `LAST · ${name}` : null);

/** A status that throws just shows nothing; it must never break the launcher. */
export async function safeStatus(get?: () => Promise<string | null>): Promise<string | null> {
	if (!get) return null;
	try {
		return await get();
	} catch (e) {
		console.error('Launcher: status failed', e);
		return null;
	}
}

export async function walletStatus(): Promise<string | null> {
	const [{ budgetSummary, walletBalances }, { formatCompact }] = await Promise.all([
		import('#lib/finance/data.ts'),
		import('#lib/core/currency.svelte.ts')
	]);
	const [summary, balances] = await Promise.all([budgetSummary(), walletBalances()]);
	return walletLine(summary, balances, (h) => formatCompact(h));
}

export async function readerStatus(): Promise<string | null> {
	const { listRecent } = await import('#lib/reader/db.ts');
	return readerLine((await listRecent())[0]?.name);
}
