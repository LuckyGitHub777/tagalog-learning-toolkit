import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../assets/js/app.js', import.meta.url), 'utf8');
const start = app.indexOf('  function registerServiceWorker()');
const end = app.indexOf('  function bindGlobalEvents()', start);
assert.ok(start >= 0 && end > start, 'registerServiceWorker source block not found');
const source = app.slice(start, end);

async function completeDocumentCase() {
  let registrations = 0;
  const sandbox = {
    navigator: {serviceWorker: {register: async () => { registrations += 1; }}},
    location: {protocol: 'https:'},
    document: {readyState: 'complete'},
    window: {addEventListener: () => { throw new Error('load listener should not be needed'); }},
    console,
  };
  vm.runInNewContext(`${source}\nregisterServiceWorker();`, sandbox);
  await Promise.resolve();
  assert.equal(registrations, 1, 'complete documents must register immediately');
}

async function loadingDocumentCase() {
  let registrations = 0;
  let listener;
  let options;
  const sandbox = {
    navigator: {serviceWorker: {register: async () => { registrations += 1; }}},
    location: {protocol: 'https:'},
    document: {readyState: 'loading'},
    window: {addEventListener: (name, callback, suppliedOptions) => {
      assert.equal(name, 'load');
      listener = callback;
      options = suppliedOptions;
    }},
    console,
  };
  vm.runInNewContext(`${source}\nregisterServiceWorker();`, sandbox);
  assert.equal(registrations, 0, 'loading documents must wait for load');
  assert.equal(options?.once, true, 'load listener must be one-shot');
  await listener();
  assert.equal(registrations, 1, 'load handler must register the service worker');
}

await completeDocumentCase();
await loadingDocumentCase();
console.log('APP LOGIC PASS: service-worker registration handles complete and loading documents');
