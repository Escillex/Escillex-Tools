/**
 * The toys, in loop order, and the presets each one can be set to.
 * Presets only: every value a toy sees is one it was designed for.
 */
export const TOY_IDS = ['bubbles', 'keys', 'ratchet', 'switches', 'pen', 'slider'] as const;
export type ToyId = (typeof TOY_IDS)[number];

export const TOY_LABELS: Record<ToyId, string> = {
	bubbles: 'BUBBLE WRAP',
	keys: 'KEYCAPS',
	ratchet: 'RATCHET',
	switches: 'SWITCHES',
	pen: 'CLICK PEN',
	slider: 'SLIDER'
};

export const isToyId = (v: unknown): v is ToyId => TOY_IDS.includes(v as ToyId);

export const SWITCH_TYPES = ['clicky', 'tactile', 'linear', 'thock', 'spacebar'] as const;
export type SwitchType = (typeof SWITCH_TYPES)[number];

/** Columns × rows. */
export const GRIDS = { small: [4, 6], medium: [6, 8], large: [8, 10] } as const;
export type GridSize = keyof typeof GRIDS;
const GRID_SIZES = Object.keys(GRIDS) as GridSize[];

export const DETENTS = [12, 24, 48] as const;
export const SWITCH_COUNTS = [4, 6, 9] as const;
export const NOTCHES = [5, 10, 20] as const;

export type Keys = [SwitchType, SwitchType, SwitchType, SwitchType];

export interface ToyPrefs {
	grid: GridSize;
	keys: Keys;
	detents: (typeof DETENTS)[number];
	switches: (typeof SWITCH_COUNTS)[number];
	notches: (typeof NOTCHES)[number];
}

export const DEFAULT_TOY_PREFS: ToyPrefs = {
	grid: 'medium',
	keys: ['clicky', 'tactile', 'linear', 'spacebar'],
	detents: 24,
	switches: 6,
	notches: 10
};

const pick = <T>(allowed: readonly T[], v: unknown, fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

/** Saved prefs from an older build or a bad write: each field not on its preset list falls back to its own default. */
export function cleanToyPrefs(raw: unknown): ToyPrefs {
	const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	const d = DEFAULT_TOY_PREFS;
	const keys = (Array.isArray(r.keys) && r.keys.length === 4 ? r.keys.map((k, i) => pick(SWITCH_TYPES, k, d.keys[i])) : [...d.keys]) as Keys;
	return {
		grid: pick(GRID_SIZES, r.grid, d.grid),
		keys,
		detents: pick(DETENTS, r.detents, d.detents),
		switches: pick(SWITCH_COUNTS, r.switches, d.switches),
		notches: pick(NOTCHES, r.notches, d.notches)
	};
}

/** A keycap slot's next switch type: tapping a slot in settings cycles through them. */
export const nextSwitch = (t: SwitchType): SwitchType => SWITCH_TYPES[(SWITCH_TYPES.indexOf(t) + 1) % SWITCH_TYPES.length];
