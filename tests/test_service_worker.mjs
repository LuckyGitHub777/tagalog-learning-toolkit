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

console.log('SERVICE WORKER TESTS PASS');
