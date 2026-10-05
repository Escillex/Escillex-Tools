/**
 * Every tool in the suite. The launcher, and later the manifest shortcuts
 * and sync, read from this list, so adding a tool starts here.
 */
export interface ToolInfo {
	id: string;
	name: string;
	href: string;
}

export const tools: ToolInfo[] = [{ id: 'finance', name: 'Wallet', href: '/wallet' }];
