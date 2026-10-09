import { identity, address, recordUrl, current, nodeType } from './identity';
/** Existing Mari presenters, backed by its application server's lake/Kafka ports. */
import { useSearchParams } from 'react-router-dom';
import type { KnowledgeData, KnowledgeActions } from '@mari-design/components/pages/KnowledgePage';
import type { DocReviewData, DocReviewActions } from '@mari-design/components/pages/DocReviewPage';
import type { LineageActions } from '@mari-design/components/pages/LineagePage';
import type { ActionContext } from '@mari-app/types';
import type { PageData } from '@mari-app/types';

import {randomId,useRead,save,request,pending,drafts,recordTables,type RecordData} from '@mari-app/records';
const refresh=()=>window.dispatchEvent(new Event('mari:knowledge-change'));
const date = (row:Pick<RecordData,'observed_at'>) => new Date(row.observed_at*1000).toISOString().slice(0,10);
const docUrl = (id:string|number) => `/knowledge/doc?id=${encodeURIComponent(id)}`;
// Preserve links created before lineage adopted the shared record address.
function documentId(params:URLSearchParams){
  const id=params.get('id'),table=params.get('table');
  return id&&id!=='new'&&!id.startsWith('[')&&table?identity({table,record_id:id}):id;
}
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
  const detail=useRead<RecordData>(id ? recordUrl(id) : null);
  const row=detail.data;
  return {loading:result.loading,error:result.error||detail.error,data:{query:q,filters,freshness,pagination:{page,pageSize,offset,hasMore:result.data?.has_more??false,nextCursor:result.data?.next_cursor??null},
    results:rows.map(r=>({id:identity(r),kind:['pr','pull_request'].includes(r.kind)?'pr':['message','thread','slack_message'].includes(r.kind)?'thread':'page',source:r.source,title:r.title,snippet:r.text.slice(0,400),author:r.actor,date:date(r),status:r.properties.status,tags:r.properties.tags||[]})),
    doc:row?{id:identity(row),title:row.title,source:row.source,kind:row.kind,owner:row.actor,updated:date(row),summary:row.text.slice(0,600),tags:row.properties.tags||[],related:[],lineage:[],timeline:[]}:null}};
}
export function usePlatformDocument(): PageData<DocReviewData> {
  const [params]=useSearchParams(); const id=documentId(params); const creating=id==='new';
  const result=useRead<RecordData>(id&&!creating?recordUrl(id):null);
  const row=result.data || (id && id !== 'new' ? drafts.get(address(id).id) : undefined);
  if(row)recordTables.set(row.record_id,row.table);
  if(result.data&&pending.get(result.data.record_id)===result.data.event_id) { pending.delete(result.data.record_id); drafts.delete(result.data.record_id); }
  return {loading:result.loading,error:row && id && pending.has(id === 'new' ? id : address(id).id) ? null : result.error,data:{
    title:row?.title||'New record',subtitle:row?[row.kind,row.source,date(row)].join(' · '):'Create knowledge content',
    save:'saved',pane:'workspace',editable:true,recordKey:id||'new',revision:row?.event_id,recordKind:row?.kind,recordProperties:row?.properties,
    pending:!!id&&pending.has(id === 'new' ? id : address(id).id),doc:{outlineBody:row?.text||'',editorBody:row?.text||'',editorFindings:[],findings:[],claims:[],
      revisions:[],
      refine:{errorN:0,warnN:0,advisoryN:0},changes:[],changeBody:''}}};
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
    openLineage:({id})=>ctx.navigate(`/lineage?${new URLSearchParams({focal:address(id).id,table:address(id).table,node_type:nodeType(id)})}`),
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
  let lastBody='',lastKey='',draftId=randomId();
  return {openLibrary:()=>ctx.navigate('/knowledge'),
    saveRecord:async({title,text,kind,properties,revision})=>{
      const id=documentId(new URLSearchParams(location.search));
      const row=id&&id!=='new'?await current(id):{table:`mari.records.mari.${kind || 'document'}`,record_id:draftId,kind:kind||'document',source:'mari',url:'',properties:{}};
      const fingerprint=JSON.stringify({id,title,text,kind,properties});
      if(fingerprint!==lastBody){lastBody=fingerprint;lastKey=randomId();}
      const result=await save({...row,title,text,kind,properties,event_id:revision},lastKey);ctx.replace(docUrl(identity({table:row.table,record_id:result.record_id})));
    },
    retractRecord:async()=>{
      const id=documentId(new URLSearchParams(location.search));if(!id||id==='new')return;
      const {table,id:recordId}=address(id);
      await request(`/api/record?id=${encodeURIComponent(recordId)}&table=${encodeURIComponent(table)}`,{method:'DELETE',headers:{'Idempotency-Key':randomId()}});
      ctx.navigate('/knowledge');
    }};
}
