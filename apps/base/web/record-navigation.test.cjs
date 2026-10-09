const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText, {exports, URLSearchParams, require: name => {
    if (!(name in imports)) throw Error('Unexpected import: ' + name);
    return imports[name];
  }});
  return exports;
}
const app = name => path.resolve(__dirname, '../../' + name + '/web/src');
function openDocument(search) {
  let requested;
  const records = {useRead(url) {requested=url;return {data:null,loading:true,error:null};},
    drafts:new Map(),pending:new Map(),recordTables:new Map()};
  const identity=load(app('knowledge')+'/identity.ts',{'@mari-app/records':records});
  const knowledge=load(app('knowledge')+'/knowledge.ts',{
    './identity':identity,'@mari-app/records':records,
    'react-router-dom':{useSearchParams:()=>[new URLSearchParams(search)]},
  });
  knowledge.usePlatformDocument();
  return new URLSearchParams(requested.split('?')[1]);
}

test('lineage opens decisions using the Knowledge table/id address', () => {
  let destination;
  const actions=load(app('lineage')+'/actions.ts',{'@mari-app/records':{}});
  actions.platformLineageActions({navigate:url=>{destination=url;}})
    .openDocument(JSON.stringify(['AgentDecision','decision:4','mari.records.agent.decision']));
  const query=openDocument(destination.split('?')[1]);
  assert.equal(query.get('id'),'decision:4');
  assert.equal(query.get('table'),'mari.records.agent.decision');
});

test('existing raw-id lineage URLs remain readable', () => {
  const query=openDocument('id=decision%3A4&node_type=AgentDecision&table=mari.records.agent.decision');
  assert.equal(query.get('id'),'decision:4');
  assert.equal(query.get('table'),'mari.records.agent.decision');
});
