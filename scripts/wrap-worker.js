/**
 * Runs after `vite build`. The SvelteKit Cloudflare adapter writes the whole
 * worker to .svelte-kit/cloudflare/_worker.js and can't add a Durable Object
 * to it. So: move that worker aside, and make _worker.js (what wrangler.jsonc
 * deploys) point at src/worker.ts, which serves the sync room and hands
 * everything else to the moved SvelteKit worker.
 */
import { appendFileSync, renameSync, writeFileSync } from 'node:fs';

const dir = '.svelte-kit/cloudflare';

renameSync(`${dir}/_worker.js`, `${dir}/sveltekit-worker.js`);
writeFileSync(`${dir}/_worker.js`, "export { default, SyncRoom } from '../../src/worker.ts';\n");
// Code, not a public file: keep it out of the uploaded static assets.
appendFileSync(`${dir}/.assetsignore`, '\nsveltekit-worker.js\n');
