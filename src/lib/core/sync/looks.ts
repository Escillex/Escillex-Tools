/**
 * The app's look (colours and fonts: the global `theme` setting and each
 * tool's `theme:<tool>`) follows you across devices, like currency: every
 * look carries the time it was last changed, and the newest change wins.
 *
 * Pure, so the merge rules can be tested without a database.
 */
export type Stamped<T = unknown> = { value: T; at: number };
/** setting key → its value and when it was set */
export type Looks = Record<string, Stamped>;

export const isLookKey = (key: string) => key === 'theme' || /^theme:[a-z0-9-]+$/.test(key);

const valid = (s: unknown): s is Stamped<object> =>
	typeof s === 'object' && s !== null && typeof (s as Stamped).at === 'number' && typeof (s as Stamped).value === 'object' && (s as Stamped).value !== null;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** The newest version of each look across the other devices. */
function newest(remotes: (Looks | undefined)[]): Looks {
	const best: Looks = {};
	for (const looks of remotes) {
		for (const [key, s] of Object.entries(looks ?? {})) {
			if (!isLookKey(key) || !valid(s)) continue;
			if (!best[key] || s.at > best[key].at) best[key] = s;
		}
	}
	return best;
}

/** Looks another device changed more recently than this one: these get written here. */
export function incomingLooks(mine: Looks, remotes: (Looks | undefined)[]): Looks {
	const take: Looks = {};
	for (const [key, theirs] of Object.entries(newest(remotes))) {
		const m = mine[key];
		if (!m || (theirs.at > m.at && !same(theirs.value, m.value))) take[key] = theirs;
	}
	return take;
}

/** How many of this device's looks are newer than every other device's (for the sync summary). */
export function outgoingLooks(mine: Looks, remotes: (Looks | undefined)[]): number {
	const theirs = newest(remotes);
	return Object.entries(mine).filter(([key, m]) => isLookKey(key) && (!theirs[key] || (m.at > theirs[key].at && !same(m.value, theirs[key].value)))).length;
}
