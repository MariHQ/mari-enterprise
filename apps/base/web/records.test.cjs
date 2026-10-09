const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function hook() {
  let cleanup, state, poll;
  const calls = [];
  const events = new EventTarget();
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(__dirname + '/records.ts', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(code, {
    exports, AbortSignal, AbortController, Event, crypto: globalThis.crypto,
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
  return {exports,calls,read:()=>exports.useRead('/api/records'),poll:()=>poll(),
    refresh:()=>events.dispatchEvent(new Event('mari:knowledge-change')),
    cleanup:()=>cleanup(),state:()=>state};
}
const flush = () => new Promise(resolve=>setImmediate(resolve));

test('slow pending-write reads do not overlap or discard the acknowledgement', async()=>{
  const h=hook();h.exports.pending.set('doc','event');h.read();
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
  assert.equal(h.calls.length,1);
  h.calls[0].resolve({records:[]});await flush();
  assert.equal(h.calls.length,2);
  h.cleanup();assert.equal(h.calls[1].init.signal.aborted,true);
  const before=h.state();h.calls[1].resolve({records:[{record_id:'stale'}]});await flush();
  assert.equal(h.state(),before);
  assert.equal(h.calls.length,2);
});
