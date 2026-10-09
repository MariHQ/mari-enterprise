import { current, identity, address } from './identity';
import { useSearchParams } from 'react-router-dom';
import type { Fact } from '@mari-design/components/features/FactsVerificationAudit';
import type { FactsActions, FactsData } from '@mari-design/components/pages/FactsPage';
import { buildFacts } from './facts';
import { randomId, save, useRead, type RecordData } from '@mari-app/records';
import type { PageData } from '@mari-app/types';

export function usePlatformFacts(): PageData<FactsData> {
  const [params]=useSearchParams();const cursors=params.getAll('after');
  const query=new URLSearchParams({kind:'fact',limit:'40'});
  if(cursors.length)query.set('cursor',cursors[cursors.length-1]);
  const result=useRead<{records:RecordData[];next_cursor:string|null}>(`/api/records?${query}`);
  const facts:Fact[]=(result.data?.records ?? []).map(r=>({id:identity(r),claim:r.text,
    source:r.properties.source_label ?? r.source,owner:r.properties.owner ?? '',
    status:r.properties.status ?? 'Needs review',verified:r.properties.verified_at ?? null,
    capturedAt:r.properties.captured_at ?? new Date(r.observed_at*1000).toISOString(),
    validFrom:r.properties.valid_from ?? null}));
  const page=(positions:string[])=>{const p=new URLSearchParams();positions.forEach(c=>p.append('after',c));return `/facts?${p}`;};
  return {loading:result.loading,error:result.error,data:{...buildFacts(facts,null,params.get('tab') ?? 'all'),
    pagination:{previous:cursors.length?page(cursors.slice(0,-1)):null,
      next:result.data?.next_cursor?page([...cursors,result.data.next_cursor]):null}}};
}
export function platformFactActions(): FactsActions {
  const update=async(id:string|number,properties:Record<string,unknown>)=>{
    const row=await current(id);await save({...row,properties:{...row.properties,...properties}});
  };
  return {
    addFact:async({claim,source,owner})=>{await save({table:'mari.records.mari.fact',record_id:randomId(),
      kind:'fact',source:'mari',title:claim.slice(0,500),text:claim,url:'',
      properties:{source_label:source,owner,status:'Needs review',captured_at:new Date().toISOString()}});},
    editFact:async({id,claim,source,owner})=>{const row=await current(id);await save({...row,title:claim.slice(0,500),text:claim,
      properties:{...row.properties,source_label:source,owner,status:'Needs review',verified_at:null}});},
    verifyFact:id=>update(id,{status:'verified',verified_at:new Date().toISOString()}),
    retireFact:id=>update(id,{status:'retired',verified_at:null}),
    restoreFact:id=>update(id,{status:'Needs review',verified_at:null}),
    inspectFactImpact:async()=>{throw new Error('GRAPH_REQUIREMENTS:Fact → affected Record edges are required to inspect impact.');},
    createReviewTask:async(fact)=>{const row=await current(fact.id);const result=await save({table:`mari.records.${row.source}.review`,record_id:randomId(),
      kind:'review',source:row.source,title:`Review: ${fact.claim}`.slice(0,500),text:'',url:'',
      properties:{record_ids:[row.record_id],status:'pending'}});
      await save({...row,properties:{...row.properties,review_ids:[...(row.properties.review_ids??[]),result.record_id]}});
      return result.record_id;},
  };
}
