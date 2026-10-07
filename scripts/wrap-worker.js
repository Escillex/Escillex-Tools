/**
 * Runs after `vite build`. The SvelteKit Cloudflare adapter writes the whole
 * worker to .svelte-kit/cloudflare/_worker.js and can't add a Durable Object
 * to it. So: move that worker aside, and make _worker.js (what wrangler.jsonc
 * deploys) point at src/worker.ts, which serves the sync room and hands
 * everything else to the moved SvelteKit worker.
 */
import { appendFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = '.svelte-kit/cloudflare';

renameSync(`${dir}/_worker.js`, `${dir}/sveltekit-worker.js`);
writeFileSync(`${dir}/_worker.js`, "export { default, SyncRoom } from '../../src/worker.ts';\n");
// Code, not a public file: keep it out of the uploaded static assets.
appendFileSync(`${dir}/.assetsignore`, '\nsveltekit-worker.js\n');

// Cloudflare rejects any static file over 25 MiB at deploy. Fail here instead, naming the file.
const LIMIT = 25 * 1024 * 1024;
const tooBig = [];
(function walk(d) {
	for (const e of readdirSync(d, { withFileTypes: true })) {
		const p = join(d, e.name);
		if (e.isDirectory()) walk(p);
		else if (statSync(p).size > LIMIT) tooBig.push(p);
	}
})(dir);
if (tooBig.length) {
	console.error(`Over Cloudflare's 25 MiB per-file limit:\n${tooBig.join('\n')}`);
	process.exit(1);
}
