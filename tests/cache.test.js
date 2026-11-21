import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
test('shell installs every listed asset and removes only old owned caches', async () => {
 const handlers = {}; let assets; const deleted = [];
 const scope = { self: { addEventListener: (name, handler) => handlers[name] = handler, skipWaiting: async () => {}, clients: {claim: async () => {}} }, caches: {open: async () => ({addAll: async values => { assets = values; }}), keys: async () => ['unrelated-cache','contentbatch-shell-old','contentbatch-shell-v1'], delete: async name => {deleted.push(name);} } };
 vm.runInNewContext(readFileSync('service-worker.js','utf8'),scope);
 let pending; handlers.install({waitUntil: promise => pending = promise}); await pending;
 assert.ok(assets.includes('./index.html'));
 for (const asset of assets) assert.ok(existsSync(asset), `${asset} exists`);
 handlers.activate({waitUntil: promise => pending = promise}); await pending;
 assert.deepEqual(deleted,['contentbatch-shell-old']);
});
