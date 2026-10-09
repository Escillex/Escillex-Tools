import { describe, expect, it } from 'vitest';
import { tablesFor } from './scope';

describe('tablesFor', () => {
	const tool = { syncTables: { wallets: 'W' }, backupTables: { counts: 'C' } };
	it('live sync never sees backup-only tables', () => {
		expect(tablesFor(tool, 'sync')).toEqual({ wallets: 'W' });
	});
	it('a backup takes both', () => {
		expect(tablesFor(tool, 'backup')).toEqual({ wallets: 'W', counts: 'C' });
	});
	it('tools without backupTables back up just their sync tables', () => {
		expect(tablesFor({ syncTables: { a: 1 } }, 'backup')).toEqual({ a: 1 });
	});
});
