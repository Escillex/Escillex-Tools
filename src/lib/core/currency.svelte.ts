/**
 * Which currency the app shows, chosen in setup and in Settings.
 * Amounts are always stored the same way (whole hundredths), so switching
 * currency only changes how they're displayed, never the numbers.
 * Number style (1,234.56 vs 1.234,56) follows the device's language.
 */
import { getSetting, setSetting } from './db';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'PHP', 'JPY', 'KRW', 'CNY', 'INR', 'SGD', 'AUD', 'CAD', 'IDR', 'MYR', 'THB', 'VND', 'AED'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Best guess from the device's region, used until the user picks one. */
const BY_REGION: Record<string, Currency> = {
	US: 'USD', PH: 'PHP', GB: 'GBP', JP: 'JPY', KR: 'KRW', CN: 'CNY', IN: 'INR', SG: 'SGD',
	AU: 'AUD', CA: 'CAD', ID: 'IDR', MY: 'MYR', TH: 'THB', VN: 'VND', AE: 'AED',
	DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR'
};

export function guessCurrency(): Currency {
	try {
		const region = new Intl.Locale(navigator.language).maximize().region;
		return (region && BY_REGION[region]) || 'USD';
	} catch {
		return 'USD';
	}
}

const locale = typeof navigator === 'undefined' ? 'en-US' : navigator.language;

let currency = $state<Currency>('USD');
let chosen = $state(false);

/** Call once at app start (the root layout does). */
export async function loadCurrency(): Promise<void> {
	const saved = await getSetting<Currency>('currency');
	chosen = !!saved && (CURRENCIES as readonly string[]).includes(saved);
	currency = chosen ? saved! : guessCurrency();

	// Data made before currencies existed was always pesos: keep it that way.
	// Stamped at time 0, so a currency picked on another device wins on sync.
	if (!chosen) {
		const { db } = await import('#lib/finance/db.ts');
		if ((await db.wallets.count()) > 0) await setCurrency('PHP', 0);
	}
}

/**
 * Pick a currency. `at` is when it was chosen; sync compares it across
 * devices so the most recent choice wins (like every other synced record).
 */
export async function setCurrency(next: Currency, at = Date.now()): Promise<void> {
	currency = next;
	chosen = true;
	await setSetting('currency', next);
	await setSetting('currencyAt', at);
}

/** For sync: the saved choice and when it was made (0 = never picked / default). */
export async function currencyForSync(): Promise<{ value: Currency; at: number } | null> {
	const value = await getSetting<Currency>('currency');
	if (!value) return null;
	return { value, at: (await getSetting<number>('currencyAt')) ?? 0 };
}

export const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v);

export const money = {
	get currency() {
		return currency;
	},
	/** False until the user has picked one (setup asks). */
	get chosen() {
		return chosen;
	},
	/** The symbol on its own, e.g. "$", "₱", "€". */
	get symbol() {
		return new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
	}
};

/** 1250 (hundredths) → "$12.50" / "₱12.50" / "12,50 €". Reading it in a template makes it update on change. */
export function formatMoney(hundredths: number): string {
	return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(hundredths / 100);
}

/** Short form for tight spots: 123456 (hundredths) → "₱1.2K". Small amounts stay exact: "₱85". */
export function formatCompact(hundredths: number, withSymbol = true): string {
	const units = Math.round(hundredths / 100);
	return new Intl.NumberFormat(locale, {
		...(withSymbol ? { style: 'currency', currency } : {}),
		notation: Math.abs(units) >= 1000 ? 'compact' : 'standard',
		maximumFractionDigits: Math.abs(units) >= 1000 ? 1 : 0
	}).format(units);
}

/** A plain whole number with the device's thousands separator: 1234 → "1,234". */
export function formatWhole(n: number): string {
	return Math.trunc(n).toLocaleString(locale);
}

/** "US Dollar"-style name for pickers. */
export function currencyName(code: Currency): string {
	try {
		return new Intl.DisplayNames([locale], { type: 'currency' }).of(code) ?? code;
	} catch {
		return code;
	}
}
