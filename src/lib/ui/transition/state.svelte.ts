/**
 * The page curtain's state. The root layout's onNavigate calls cover()
 * and waits for it (the page swaps underneath while covered), then calls
 * reveal(). Curtain.svelte draws whatever phase this is in.
 *
 * A navigation that starts while the curtain is still playing doesn't
 * queue: the curtain jumps straight to covered and the earlier promise
 * resolves, so nothing ever waits on a cancelled animation.
 */
import type { Launch, Plan } from './plan';

export type Phase = 'idle' | 'cover' | 'covered' | 'reveal';

export class Curtain {
	phase = $state<Phase>('idle');
	plan = $state<Plan | null>(null);
	#timer: ReturnType<typeof setTimeout> | undefined;
	#done: (() => void) | null = null;
	#launch: Launch | null = null;

	/** The launcher calls this right before it navigates. */
	arm(launch: Launch) {
		this.#launch = launch;
	}

	/** What arm() left, cleared so a later navigation doesn't reuse it. */
	take(): Launch | null {
		const l = this.#launch;
		this.#launch = null;
		return l;
	}

	cover(plan: Plan): Promise<void> {
		const busy = this.phase !== 'idle';
		this.#finish();
		this.plan = plan;
		if (busy) {
			this.phase = 'covered';
			return Promise.resolve();
		}
		this.phase = 'cover';
		return this.#wait(plan.coverMs, () => (this.phase = 'covered'));
	}

	reveal(): Promise<void> {
		const plan = this.plan;
		if (!plan || this.phase === 'idle') return Promise.resolve();
		this.#finish();
		this.phase = 'reveal';
		return this.#wait(plan.revealMs, () => {
			this.phase = 'idle';
			this.plan = null;
		});
	}

	#wait(ms: number, then: () => void): Promise<void> {
		return new Promise((resolve) => {
			this.#done = resolve;
			this.#timer = setTimeout(() => {
				this.#done = null;
				then();
				resolve();
			}, ms);
		});
	}

	/** Cut short whatever is playing and let its waiter go. */
	#finish() {
		clearTimeout(this.#timer);
		this.#done?.();
		this.#done = null;
	}
}

export const curtain = new Curtain();
