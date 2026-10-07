import { describe, expect, it } from 'vitest';
import { isAccessBlocked } from './files';

describe('isAccessBlocked', () => {
	it('spots a browser that hands out file handles but refuses to read them', () => {
		expect(isAccessBlocked(new DOMException('The request is not allowed', 'NotAllowedError'))).toBe(true);
	});

	it('leaves other failures alone', () => {
		expect(isAccessBlocked(new DOMException('gone', 'NotFoundError'))).toBe(false);
		expect(isAccessBlocked(new DOMException('cancelled', 'AbortError'))).toBe(false);
		expect(isAccessBlocked(new Error('NotAllowedError'))).toBe(false);
		expect(isAccessBlocked(null)).toBe(false);
	});
});
