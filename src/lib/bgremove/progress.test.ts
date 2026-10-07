import { describe, expect, it } from 'vitest';
import { mb, progressLabel, sumFiles } from './progress';

describe('progress', () => {
	it('adds up every file', () => {
		expect(sumFiles({ runtime: { loaded: 5, total: 10 }, 'onnx/model.onnx': { loaded: 1, total: 40 } })).toEqual({ loaded: 6, total: 50 });
		expect(sumFiles({})).toEqual({ loaded: 0, total: 0 });
	});
	it('formats megabytes', () => {
		expect(mb(6.3 * 1048576)).toBe('6.3 MB');
		expect(mb(109.2 * 1048576)).toBe('109 MB');
		expect(progressLabel({ loaded: 23 * 1048576, total: 45 * 1048576 })).toBe('23 / 45 MB');
	});
});
