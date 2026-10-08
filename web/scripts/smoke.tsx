import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PAGES } from '@mari-design/components/pages';
import { adapterFor } from '../src/data';
import { buildFacts } from '../src/data/facts';
import { buildDecisions } from '../src/data/decisions';
import { buildLineage } from '../src/data/lineage';

// Missing platform mappings must not run an old GraphQL query or render fake data.
for (const id of ['library','publish','settings-models']) {
  const result = adapterFor(id)();
  assert.equal(result.data, null);
  assert.match(result.error!, /^GRAPH_REQUIREMENTS:/);
}
for (const [id,data] of [['facts',buildFacts([],null)],['decisions',buildDecisions([],'all')],['lineage',buildLineage(null)]] as const) {
  const Page=PAGES.find(p=>p.id===id)!.component;
  const html=renderToStaticMarkup(<MemoryRouter><Page data={data as any} loading={false} error={null}/></MemoryRouter>);
  assert.ok(html.length>0, `${id} renders`);
}
console.log('Platform presentation and missing-mapping checks passed');
