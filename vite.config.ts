import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Tests compile Svelte for the browser, so $effect runs in tests just as it does in the app.
// (process is read through globalThis: the project has no Node type definitions.)
const vitest = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VITEST;

export default defineConfig({
	resolve: vitest ? { conditions: ['browser'] } : undefined,
	ssr: vitest ? { resolve: { conditions: ['browser'], externalConditions: ['browser'] }, noExternal: ['svelte'] } : undefined,
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			...(vitest ? { dynamicCompileOptions: () => ({ generate: 'client' as const }) } : {}),

			// Builds for Cloudflare Workers; deploy settings live in wrangler.jsonc.
			adapter: adapter()
		})
	]
});
