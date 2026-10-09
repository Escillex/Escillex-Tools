/**
 * The Sound and Haptics switches (in Settings, and in Fidget's header).
 * Per device, never synced. feedback.ts holds the live gates so tick()
 * stays a plain function; this file keeps them reactive and saved.
 */
import { getSetting, setSetting } from './db';
import { setFeedbackGates } from '#lib/ui/feedback.ts';

export interface FeedbackPrefs {
	sound: boolean;
	haptics: boolean;
}

/** Anything that isn't a stored false counts as on. */
export function cleanFeedback(raw: unknown): FeedbackPrefs {
	const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	return { sound: r.sound !== false, haptics: r.haptics !== false };
}

let prefs = $state<FeedbackPrefs>({ sound: true, haptics: true });

export async function loadFeedback(): Promise<void> {
	prefs = cleanFeedback(await getSetting('feedback'));
	setFeedbackGates(prefs);
}

export const feedback = {
	get sound() {
		return prefs.sound;
	},
	get haptics() {
		return prefs.haptics;
	},
	/** The gates change straight away (before the save), so the next tick already follows them. */
	async set(patch: Partial<FeedbackPrefs>) {
		prefs = { ...prefs, ...patch };
		setFeedbackGates(prefs);
		await setSetting('feedback', { ...prefs });
	}
};
