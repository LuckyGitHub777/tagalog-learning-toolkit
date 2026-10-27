import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
const start = source.indexOf('async function staleWhileRevalidate');
const end = source.indexOf('\n\nasync function navigationResponse', start);
assert.ok(start >= 0 && end > start, 'Could not find staleWhileRevalidate in shipped service worker');
const functionSource = source.slice(start, end);

async function loadFunction({cached = null, network = null, reject = false} = {}) {
  const context = {
    CACHE: 'test-cache',
    Response,
    caches: {
      open: async () => ({
        match: async () => cached,
        put: async () => {}
      })
    },
    fetch: async () => {
      if (reject) throw new Error('offline');
      return network;
    }
  };
  vm.createContext(context);
  vm.runInContext(`${functionSource}; this.testFunction = staleWhileRevalidate;`, context);
  return context.testFunction({url:'https://tagalog.academy/data/catalog.json'});
}

const unavailable = await loadFunction({reject:true});
assert.ok(unavailable instanceof Response);
assert.equal(unavailable.status, 503);

const cachedResponse = new Response('cached', {status:200});
const cacheHit = await loadFunction({cached:cachedResponse, reject:true});
assert.ok(cacheHit instanceof Response);
assert.equal(await cacheHit.text(), 'cached');

const freshResponse = new Response('fresh', {status:200});
const fresh = await loadFunction({network:freshResponse});
assert.ok(fresh instanceof Response);
assert.equal(await fresh.text(), 'fresh');

// A cached copy is returned without waiting for the network; the refresh continues in the background.
{
  let resolveNetwork;
  const pending = new Promise(resolve => { resolveNetwork = resolve; });
  const stored = [];
  const waited = [];
  const context = {
    CACHE: 'test-cache',
    Response,
    caches: {open: async () => ({match: async () => new Response('cached'), put: async (_req, res) => { stored.push(await res.text()); }})},
    fetch: () => pending
  };
  vm.createContext(context);
  vm.runInContext(`${functionSource}; this.testFunction = staleWhileRevalidate;`, context);
  const event = {waitUntil: promise => waited.push(promise)};
  const result = await Promise.race([
    context.testFunction({url: 'https://tagalog.academy/data/catalog.json'}, event),
    new Promise((_, reject) => setTimeout(() => reject(new Error('waited for the network')), 200))
  ]);
  assert.equal(await result.text(), 'cached');
  assert.equal(waited.length, 1);
  resolveNetwork(new Response('fresh', {status: 200}));
  await waited[0];
  assert.deepEqual(stored, ['fresh']);
}

// Install and activate lifecycle, evaluated against the shipped worker.
async function lifecycle({failing = [], keys = []} = {}) {
  const handlers = {};
  const added = [];
  const deleted = [];
  const cache = {
    addAll: async list => {
      if (list.some(asset => failing.includes(asset))) throw new Error('fetch failed');
      added.push(...list);
    },
    add: async asset => {
      if (failing.includes(asset)) throw new Error('fetch failed');
      added.push(asset);
    }
  };
  const context = {
    Response, URL,
    self: {addEventListener: (type, handler) => { handlers[type] = handler; }, location: {origin: 'https://tagalog.academy'}},
    caches: {open: async () => cache, keys: async () => keys, delete: async key => { deleted.push(key); return true; }}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const run = async type => {
    let work;
    handlers[type]({waitUntil: promise => { work = promise; }});
    return work;
  };
  return {run, added, deleted, shell: vm.runInContext('SHELL', context), optional: vm.runInContext('OPTIONAL', context), cacheName: vm.runInContext('CACHE', context)};
}

{
  const ok = await lifecycle();
  await ok.run('install');
  assert.ok(ok.shell.every(asset => ok.added.includes(asset)), 'every shell file is cached');
  assert.ok(ok.optional.every(asset => ok.added.includes(asset)), 'optional files are cached when available');
}
{
  const probe = await lifecycle();
  const missingShell = await lifecycle({failing: [probe.shell.find(asset => asset.endsWith('app.js'))]});
  await assert.rejects(missingShell.run('install'), /fetch failed/, 'a missing shell file must fail installation');
}
{
  const probe = await lifecycle();
  const missingOptional = await lifecycle({failing: [probe.optional[0]]});
  await missingOptional.run('install');
  assert.ok(missingOptional.shell.every(asset => missingOptional.added.includes(asset)));
}
{
  const probe = await lifecycle();
  const older = 'tagalog-academy-v0.0.1';
  const unrelated = 'another-app-cache';
  const active = await lifecycle({keys: [older, probe.cacheName, unrelated]});
  await active.run('activate');
  assert.deepEqual(active.deleted, [older], 'only earlier Tagalog Academy caches are removed');
}

console.log('SERVICE WORKER TESTS PASS');
