/**
 * Which of a tool's tables a snapshot covers. Live sync takes only
 * syncTables. A backup file also takes backupTables: data worth keeping
 * on a new phone that changes too often to push through the room.
 */
export type Scope = 'sync' | 'backup';

export function tablesFor<T>(tool: { syncTables: Record<string, T>; backupTables?: Record<string, T> }, scope: Scope): Record<string, T> {
	return scope === 'backup' ? { ...tool.syncTables, ...tool.backupTables } : tool.syncTables;
}
