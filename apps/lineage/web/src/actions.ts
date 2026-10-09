import {current,save,request,type RecordData} from '@mari-app/records';
import type {ActionContext} from '@mari-app/types';
import type {LineageActions} from '@mari-design/components/pages/LineagePage';
const date=(row:Pick<RecordData,'observed_at'>)=>new Date(row.observed_at*1000).toISOString().slice(0,10);
const docUrl=(id:string|number)=>`/knowledge/doc?id=${encodeURIComponent(id)}`;
export function platformLineageActions(ctx:ActionContext):LineageActions {
  const route=(patch:Record<string,string>)=>{const params=new URLSearchParams(location.search);Object.entries(patch).forEach(([k,v])=>params.set(k,v));ctx.replace(`/lineage?${params}`);};
  return {openDocument:id=>ctx.navigate(docUrl(id)),setFocalNode:id=>route({focal:id}),setMode:mode=>route({mode}),
    pinNode:async({docId,x,y})=>{const row=await current(docId);await save({...row,properties:{...row.properties,x,y}});},
    unpinNode:async id=>{const row=await current(id);const {x,y,...properties}=row.properties;await save({...row,properties});},
    loadDocHistory:async id=>{const row=await current(id);const result=await request<{rows:RecordData[]}>(`/api/history?id=${encodeURIComponent(id)}&table=${encodeURIComponent(row.table)}`);
      return result.rows.map(r=>({at:date(r),actor:r.actor,verb:(r as any).operation,detail:r.title}));}};
}
