import { describe, expect, it } from 'vitest';
import { ImageError, classify } from './protocol';

describe('classify', () => {
	it('spots running out of memory', () => {
		expect(classify(new RangeError('Array buffer allocation failed'))).toBe('memory');
		expect(classify(new Error('WebAssembly.Memory(): could not allocate memory'))).toBe('memory');
		expect(classify(new Error('GPU device lost'))).toBe('memory');
		expect(classify('Out of memory')).toBe('memory');
		expect(classify(new Error('failed to call OrtRun(). ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc'))).toBe('memory'); // WASM heap full
	});
	it('spots network failures', () => {
		expect(classify(new TypeError('Failed to fetch'))).toBe('network');
		expect(classify(new Error('NetworkError when attempting to fetch resource.'))).toBe('network');
		expect(classify(new Error('network: runtime 404'))).toBe('network');
	});
	it('spots unreadable images', () => {
		expect(classify(new ImageError('bad'))).toBe('image');
	});
	it('anything else is a plain failure', () => {
		expect(classify(new Error('Session already started'))).toBe('failed');
		expect(classify(undefined)).toBe('failed');
	});
});
