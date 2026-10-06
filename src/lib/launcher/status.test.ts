import { describe, expect, it, vi } from 'vitest';
import type { BudgetSummary } from '#lib/finance/data.ts';
import { readerLine, safeStatus, walletLine } from './status';

const fmt = (h: number) => `₱${h / 100}`;
const summary = (allowance: number) => ({ byWallet: { all: { allowance, remaining: 0 } } }) as unknown as BudgetSummary;

describe('walletLine', () => {
	it('shows what is left today when there is a budget', () => {
		expect(walletLine(summary(41200), { a: 1 }, fmt)).toBe('₱412 LEFT TODAY');
	});
	it('shows the total balance without a budget', () => {
		expect(walletLine(null, { a: 100000, b: 221000 }, fmt)).toBe('₱3210 TOTAL');
	});
	it('says nothing with no wallets', () => {
		expect(walletLine(null, {}, fmt)).toBeNull();
	});
});

describe('readerLine', () => {
	it('names the last file', () => {
		expect(readerLine('notes.md')).toBe('LAST · notes.md');
	});
	it('says nothing with no recent files', () => {
		expect(readerLine(undefined)).toBeNull();
	});
});

describe('safeStatus', () => {
	it('passes a value through', async () => {
		expect(await safeStatus(async () => 'hi')).toBe('hi');
	});
	it('turns a failure into nothing, so the launcher still draws', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await safeStatus(async () => Promise.reject(new Error('dexie')))).toBeNull();
		err.mockRestore();
	});
	it('handles a tool with no status', async () => {
		expect(await safeStatus(undefined)).toBeNull();
	});
});
