/** Existing Mari presenters, backed by its application server's lake/Kafka ports. */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { KnowledgeData, KnowledgeActions } from '@mari-design/components/pages/KnowledgePage';
import type { DocReviewData, DocReviewActions } from '@mari-design/components/pages/DocReviewPage';
import type { LineageActions } from '@mari-design/components/pages/LineagePage';
import { authenticatedFetch, projectHeaders } from '../lib/api';
import type { ActionContext } from './actions';
import type { PageData } from './types';

export type RecordData = {
  table: string; record_id: string; event_id: string; kind: string; source: string; title: string;
  text: string; url: string; actor: string; observed_at: number;
  properties: Record<string, any>;
};
const pending = new Map<string, string>();
const drafts = new Map<string, RecordData>();
const recordTables = new Map<string, string>();
const refresh = () => window.dispatchEvent(new Event('mari:knowledge-change'));
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, { signal: AbortSignal.timeout(40000), ...init, headers: { 'Content-Type': 'application/json', ...projectHeaders(), ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
  return data as T;
}
export function useRead<T>(path: string | null) {
  const [state, setState] = useState<{data:T|null;loading:boolean;error:string|null}>({data:null,loading:true,error:null});
  useEffect(() => {
    let active = true; let generation=0;
    const load = () => {
      const requestGeneration=++generation;
      if (!path) { setState({data:null,loading:false,error:null}); return; }
      request<T>(path).then(data => {
        if(active && requestGeneration===generation) {
          const rows=(data as {records?:RecordData[]})?.records ?? [];
          for(const row of rows)if(pending.get(row.record_id)===row.event_id){pending.delete(row.record_id);drafts.delete(row.record_id);}
          setState({data,loading:false,error:null});
        }
      })
        .catch(error => { if(active && requestGeneration===generation) setState(s=>({...s,loading:false,error:error.message})); });
    };
    setState({data:null,loading:true,error:null}); load();
    const timer = window.setInterval(() => { if(pending.size) load(); },3000);
    window.addEventListener('mari:knowledge-change',load);
    return () => { active=false; clearInterval(timer); window.removeEventListener('mari:knowledge-change',load); };
  },[path]);
  return state;
}
const date = (row:Pick<RecordData,'observed_at'>) => new Date(row.observed_at*1000).toISOString().slice(0,10);
const docUrl = (id:string|number) => `/knowledge/doc?id=${encodeURIComponent(id)}`;
export function usePlatformKnowledge(): PageData<KnowledgeData> {
  const [params]=useSearchParams(); const q=params.get('q')||'';
  const pageSize=40;
  const cursors=params.getAll('after');
  const page=cursors.length+1;
  const offset=(page-1)*pageSize;
  const filters={source:params.getAll('source'),owner:params.getAll('owner'),status:params.getAll('status'),content_type:params.getAll('content_type'),tab:params.get('tab')||'all',sort:params.get('sort')==='title'?'title':'newest'};
  const days=Number(params.get('days')); const freshness=days>0&&days<=36500?days:null;
  const search=new URLSearchParams({q,limit:String(pageSize),summary:'true',sort:filters.sort});
  if(cursors.length)search.set('cursor',cursors[cursors.length-1]);
  for(const key of ['source','owner','status','content_type'] as const) filters[key].forEach(value=>search.append(key,value));
  const tabType=({docs:'Documents',conv:'Conversations',prs:'Pull requests'} as Record<string,string>)[filters.tab];
  if(tabType){ search.delete('content_type'); search.append('content_type',tabType); }
  if(freshness)search.set('days',String(freshness));
  const result=useRead<{records:RecordData[];has_more:boolean;next_cursor:string|null}>(`/api/records?${search}`);
  const rows=result.data?.records||[]; const id=params.get('doc');
  const detail=useRead<RecordData>(id ? `/api/record?id=${encodeURIComponent(id)}` : null);
  const row=detail.data;
  return {loading:result.loading,error:result.error||detail.error,data:{query:q,filters,freshness,pagination:{page,pageSize,offset,hasMore:result.data?.has_more??false,nextCursor:result.data?.next_cursor??null},
    results:rows.map(r=>({id:r.record_id,kind:['pr','pull_request'].includes(r.kind)?'pr':['message','thread','slack_message'].includes(r.kind)?'thread':'page',source:r.source,title:r.title,snippet:r.text.slice(0,400),author:r.actor,date:date(r),status:r.properties.status,tags:r.properties.tags||[]})),
    doc:row?{id:row.record_id,title:row.title,source:row.source,kind:row.kind,owner:row.actor,updated:date(row),summary:row.text.slice(0,600),tags:row.properties.tags||[],related:[],lineage:[],timeline:[]}:null}};
}
export function usePlatformDocument(): PageData<DocReviewData> {
  const [params]=useSearchParams(); const id=params.get('id'); const creating=id==='new';
  const result=useRead<RecordData>(id&&!creating?`/api/record?id=${encodeURIComponent(id)}`:null);
  const history=useRead<{rows:RecordData[]}>(id&&!creating&&result.data?.table?`/api/history?id=${encodeURIComponent(id)}&table=${encodeURIComponent(result.data.table)}`:null);
  const row=result.data || (id ? drafts.get(id) : undefined);
  if(row)recordTables.set(row.record_id,row.table);
  if(result.data&&pending.get(result.data.record_id)===result.data.event_id) { pending.delete(result.data.record_id); drafts.delete(result.data.record_id); }
  return {loading:result.loading,error:row && id && pending.has(id) ? null : result.error||history.error,data:{
    title:row?.title||'New record',subtitle:row?[row.kind,row.source,date(row)].join(' · '):'Create knowledge content',
    save:'saved',pane:'workspace',editable:true,recordKey:id||'new',revision:row?.event_id,recordKind:row?.kind,recordProperties:row?.properties,
    pending:!!id&&pending.has(id),doc:{outlineBody:row?.text||'',editorBody:row?.text||'',editorFindings:[],findings:[],claims:[],
      revisions:(history.data?.rows||[]).map((r:any)=>({id:r.event_id,actor:r.actor,verb:r.operation,at:date(r)})),
      refine:{errorN:0,warnN:0,advisoryN:0},changes:[],changeBody:''}}};
}
export { usePlatformLineage } from './platform-lineage';

export async function current(id:string|number) {return request<RecordData>(`/api/record?id=${encodeURIComponent(id)}`);}
export async function save(row:Partial<RecordData>,requestId: string=crypto.randomUUID()) {
  const {event_id,observed_at,actor,...body}=row;
  const result=await request<{event_id:string;record_id:string}>('/api/records',{method:'POST',headers:{'Idempotency-Key':requestId},
    body:JSON.stringify({...body,expected_revision:event_id})});
  pending.set(result.record_id,result.event_id);
  drafts.set(result.record_id,{...row,record_id:result.record_id,event_id:result.event_id,observed_at:Math.floor(Date.now()/1000),actor:'Owner'} as RecordData);
  refresh();return result;
}
export function platformKnowledgeActions(ctx:ActionContext):KnowledgeActions {
  const route=(patch:Record<string,string|null>)=>{
    const params=new URLSearchParams(location.search);
    if("q" in patch || "days" in patch)params.delete("after");
    Object.entries(patch).forEach(([key,value])=>value===null?params.delete(key):params.set(key,value));
    ctx.replace(`/knowledge?${params}`);
  };
  return {select:({id})=>route({doc:id}),setQuery:({query})=>route({q:query,k:null,page:null,doc:null}),
    create:()=>ctx.navigate(docUrl('new')),
    refresh,
    openRecord:({id})=>ctx.navigate(docUrl(id)),
    openLineage:({id})=>ctx.navigate(`/lineage?focal=${encodeURIComponent(id)}`),
    setPage:({page,cursor})=>{
      const params=new URLSearchParams(location.search);const history=params.getAll('after');
      if(page<=history.length)history.pop();else if(cursor)history.push(cursor);
      params.delete('after');history.forEach(c=>params.append('after',c));params.delete('doc');
      ctx.replace(`/knowledge?${params}`);
    },
    setFreshness:({days})=>route({days:days?String(days):null,page:null,doc:null}),
    setFilters:filters=>{
      const params=new URLSearchParams(location.search);
      for(const key of ['source','owner','status','content_type'] as const){params.delete(key);filters[key].forEach(v=>params.append(key,v));}
      params.set('tab',filters.tab);params.set('sort',filters.sort);params.delete('page');params.delete('after');params.delete('doc');
      ctx.replace(`/knowledge?${params}`);
    },
    setTag:async({id,tag,on})=>{const row=await current(id);const tags=new Set<string>(row.properties.tags||[]);on?tags.add(tag):tags.delete(tag);
      await save({...row,properties:{...row.properties,tags:[...tags]}});return [...tags];}};
}
export function platformDocumentActions(ctx:ActionContext):DocReviewActions {
  // Hold one command key across an ambiguous network retry of the same edit.
  let lastBody='',lastKey='',draftId=crypto.randomUUID();
  return {openLibrary:()=>ctx.navigate('/knowledge'),
    saveRecord:async({title,text,kind,properties,revision})=>{
      const id=new URLSearchParams(location.search).get('id');
      const row=id&&id!=='new'?await current(id):{table:`mari.records.mari.${kind || 'document'}`,record_id:draftId,kind:kind||'document',source:'mari',url:'',properties:{}};
      const fingerprint=JSON.stringify({id,title,text,kind,properties});
      if(fingerprint!==lastBody){lastBody=fingerprint;lastKey=crypto.randomUUID();}
      const result=await save({...row,title,text,kind,properties,event_id:revision},lastKey);ctx.replace(docUrl(result.record_id));
    },
    retractRecord:async()=>{
      const id=new URLSearchParams(location.search).get('id');if(!id||id==='new')return;
      const table=recordTables.get(id);if(!table)throw new Error('Load the record before deleting it');
      await request(`/api/record?id=${encodeURIComponent(id)}&table=${encodeURIComponent(table)}`,{method:'DELETE',headers:{'Idempotency-Key':crypto.randomUUID()}});
      ctx.navigate('/knowledge');
    }};
}
export function platformLineageActions(ctx:ActionContext):LineageActions {
  const route=(patch:Record<string,string>)=>{const params=new URLSearchParams(location.search);Object.entries(patch).forEach(([k,v])=>params.set(k,v));ctx.replace(`/lineage?${params}`);};
  return {openDocument:id=>ctx.navigate(docUrl(id)),setFocalNode:id=>route({focal:id}),setMode:mode=>route({mode}),
    pinNode:async({docId,x,y})=>{const row=await current(docId);await save({...row,properties:{...row.properties,x,y}});},
    unpinNode:async id=>{const row=await current(id);const {x,y,...properties}=row.properties;await save({...row,properties});},
    loadDocHistory:async id=>{const row=await current(id);const result=await request<{rows:RecordData[]}>(`/api/history?id=${encodeURIComponent(id)}&table=${encodeURIComponent(row.table)}`);
      return result.rows.map(r=>({at:date(r),actor:r.actor,verb:(r as any).operation,detail:r.title}));}};
}
