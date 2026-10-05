import { describe, expect, it } from 'vitest';
import { progressFor, searchProgress } from './progress';

describe('searchProgress', () => {
	it('starts at 10%', () => {
		expect(searchProgress(0)).toBe(10);
	});

	it('creeps up, slowing down', () => {
		expect(searchProgress(20_000)).toBeCloseTo(28.96, 1);
		expect(searchProgress(60_000)).toBeCloseTo(38.51, 1);
	});

	it('never reaches 40%, even after a long wait', () => {
		expect(searchProgress(120_000)).toBeLessThan(40);
		expect(searchProgress(10 * 60_000)).toBeLessThan(40);
	});
});

describe('progressFor', () => {
	it('fills the bar step by step', () => {
		expect(progressFor('connecting', 0)).toBe(5);
		expect(progressFor('sending', 0)).toBe(50);
		expect(progressFor('receiving', 0)).toBe(70);
		expect(progressFor('comparing', 0)).toBe(90);
	});

	it('uses the creep while searching', () => {
		expect(progressFor('searching', 20_000)).toBe(searchProgress(20_000));
	});
});
