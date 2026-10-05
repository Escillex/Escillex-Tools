import { liveQuery } from 'dexie';

/**
 * Run a database read and keep the result fresh. Whenever any table the
 * query touched changes (in this tab or another), Dexie re-runs it and
 * `.current` updates, which re-renders whatever uses it.
 *
 * Call it during component setup (top of <script>), like $state.
 */
export function live<T>(query: () => Promise<T>, initial: T) {
	let value = $state(initial);
	let loaded = $state(false);

	$effect(() => {
		const sub = liveQuery(query).subscribe({
			next: (v) => {
				value = v;
				loaded = true;
			},
			error: (e) => console.error('Live query failed', e)
		});
		return () => sub.unsubscribe();
	});

	return {
		get current() {
			return value;
		},
		get loaded() {
			return loaded;
		}
	};
}
