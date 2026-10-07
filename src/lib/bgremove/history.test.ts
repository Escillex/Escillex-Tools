import { describe, expect, it } from 'vitest';
import { DAY, EXPIRE_MS, acceptFile, clampKeep, expiryLabel, isQuota, outName, prunePlan } from './history';

describe('outName', () => {
	it('swaps the extension for -bgremoved.png', () => {
		expect(outName('dog.jpg')).toBe('dog-bgremoved.png');
		expect(outName('my.holiday.photo.HEIC')).toBe('my.holiday.photo-bgremoved.png');
		expect(outName('noext')).toBe('noext-bgremoved.png');
		expect(outName('.jpg')).toBe('image-bgremoved.png');
		expect(outName('')).toBe('image-bgremoved.png');
	});
});

describe('expiryLabel', () => {
	const at = new Date(2026, 9, 7, 14, 30).getTime();
	const created = at - EXPIRE_MS; // expires exactly at 14:30
	it('says nothing until the last 24 hours', () => {
		expect(expiryLabel({ createdAt: created }, at - DAY - 1)).toBeNull();
	});
	it('shows the expiry time in the last 24 hours', () => {
		expect(expiryLabel({ createdAt: created }, at - DAY + 1)).toBe('expires 14:30');
		expect(expiryLabel({ createdAt: created }, at - 60_000)).toBe('expires 14:30');
	});
	it('says nothing once expired (pruning removes it)', () => {
		expect(expiryLabel({ createdAt: created }, at)).toBeNull();
	});
});

describe('prunePlan', () => {
	const now = 100 * DAY;
	const item = (id: string, ageDays: number) => ({ id, createdAt: now - ageDays * DAY });
	it('drops expired items', () => {
		expect(prunePlan([item('old', 8), item('new', 1)], now, 100)).toEqual(['old']);
	});
	it('drops the oldest beyond the keep count', () => {
		expect(prunePlan([item('c', 1), item('a', 3), item('b', 2)], now, 2)).toEqual(['a']);
	});
	it('does both without listing anything twice', () => {
		expect(prunePlan([item('x', 9), item('a', 3), item('b', 2), item('c', 1)], now, 2).sort()).toEqual(['a', 'x']);
	});
});

describe('clampKeep', () => {
	it('keeps 1..100', () => {
		expect(clampKeep(0)).toBe(1);
		expect(clampKeep(150)).toBe(100);
		expect(clampKeep(20.4)).toBe(20);
		expect(clampKeep(NaN)).toBe(100);
	});
});

describe('acceptFile', () => {
	it('takes images, rejects the rest', () => {
		expect(acceptFile({ type: 'image/jpeg', name: 'a.jpg' })).toBe(true);
		expect(acceptFile({ type: '', name: 'a.HEIC' })).toBe(true); // some browsers leave type empty
		expect(acceptFile({ type: 'application/pdf', name: 'a.pdf' })).toBe(false);
		expect(acceptFile({ type: '', name: 'notes.txt' })).toBe(false);
	});
});

describe('isQuota', () => {
	it('recognises a full disk, however it is wrapped', () => {
		expect(isQuota(new DOMException('full', 'QuotaExceededError'))).toBe(true);
		expect(isQuota({ name: 'QuotaExceededError' })).toBe(true);
		expect(isQuota({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true); // Dexie
		expect(isQuota(new Error('nope'))).toBe(false);
	});
});
