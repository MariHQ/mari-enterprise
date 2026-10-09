const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function hook(browserCrypto = globalThis.crypto) {
  let cleanup, state, poll;
  const calls = [];
  const events = new EventTarget();
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/records.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(code, {
    exports, AbortSignal, AbortController, Event, crypto: browserCrypto,
    clearInterval() {poll=null;},
    window: {
      setInterval(fn) {poll=fn; return 1;}, clearInterval() {poll=null;},
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    },
    require(name) {
      if(name==='react') return {
        useState(initial) {state=initial;return [state, value=>{state=typeof value==='function'?value(state):value;}];},
        useEffect(effect) {cleanup=effect();},
      };
      if(name==='./http') return {
        projectHeaders: ()=>({}),
        authenticatedFetch(path, init) {
          return new Promise(resolve=>calls.push({path, init, resolve: data=>resolve({ok:true,json:async()=>data})}));
        },
      };
      throw new Error(name);
    },
  });
  return {exports,calls,read:()=>exports.useRead('/api/records'),poll:()=>poll?.(),hasPoll:()=>!!poll,
    refresh:()=>events.dispatchEvent(new Event('mari:knowledge-change')),
    cleanup:()=>cleanup(),state:()=>state};
}
const flush = () => new Promise(resolve=>setImmediate(resolve));

test('HTTP contexts create UUIDs using Web Crypto without randomUUID', () => {
  const webcrypto = require('node:crypto').webcrypto;
  const h = hook({getRandomValues: bytes => webcrypto.getRandomValues(bytes)});
  const ids = Array.from({length: 100}, () => h.exports.randomId());
  assert.equal(new Set(ids).size, 100);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('secure contexts retain native UUID generation', () => {
  const browserCrypto = {randomUUID() {assert.equal(this, browserCrypto);return 'native-id';}};
  assert.equal(hook(browserCrypto).exports.randomId(), 'native-id');
});

test('pending writes never start recurring reads', async()=>{
  const h=hook();h.exports.pending.set('doc','event');h.read();
  await flush();
  assert.equal(h.hasPoll(),false);
  for(let n=0;n<20;n++)h.poll();
  assert.equal(h.calls.length,1);
  h.calls[0].resolve({records:[{record_id:'doc',event_id:'event'}]});await flush();
  assert.equal(h.exports.pending.size,0);
  assert.equal(h.state().data.records[0].record_id,'doc');
  h.poll();assert.equal(h.calls.length,1);
  h.cleanup();
});

test('refreshes coalesce and unmount aborts the active read', async()=>{
  const h=hook();h.read();h.refresh();h.refresh();h.refresh();
  await flush();
  assert.equal(h.calls.length,1);
  h.calls[0].resolve({records:[]});await flush();
  assert.equal(h.calls.length,2);
  h.cleanup();assert.equal(h.calls[1].init.signal.aborted,true);
  const before=h.state();h.calls[1].resolve({records:[{record_id:'stale'}]});await flush();
  assert.equal(h.state(),before);
  assert.equal(h.calls.length,2);
});

test('cards resolve independently with at most two concurrent reads',async()=>{
  const h=hook();
  const first=h.exports.request('/stats');const second=h.exports.request('/recent');const third=h.exports.request('/sources');
  await flush();assert.equal(h.calls.length,2);
  h.calls[1].resolve({ready:'recent'});
  assert.equal((await second).ready,'recent');
  await flush();assert.equal(h.calls.length,3);
  h.calls[2].resolve({ready:'sources'});await third;
  h.calls[0].resolve({ready:'stats'});await first;
});
