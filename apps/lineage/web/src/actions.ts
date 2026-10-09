import {save,request,type RecordData} from '@mari-app/records';
import type {ActionContext} from '@mari-app/types';
import type {LineageActions} from '@mari-design/components/pages/LineagePage';
const date=(row:Pick<RecordData,'observed_at'>)=>new Date(row.observed_at*1000).toISOString().slice(0,10);
const identity=(value:string|number):[string,string,string?]=>{try{return JSON.parse(String(value));}catch{throw new Error('Select a node with a catalog type');}};
const docUrl=(value:string|number)=>{const [,id,table]=identity(value);if(!table)throw new Error('Selected record has no table');return `/knowledge/doc?${new URLSearchParams({id:JSON.stringify([table,id])})}`;};
export function platformLineageActions(ctx:ActionContext):LineageActions {
  const route=(patch:Record<string,string>)=>{const params=new URLSearchParams(location.search);Object.entries(patch).forEach(([k,v])=>params.set(k,v));ctx.replace(`/lineage?${params}`);};
  return {openDocument:id=>ctx.navigate(docUrl(id)),setFocalNode:id=>route({focal:id}),setMode:mode=>route({mode}),
    pinNode:async({docId,x,y})=>{await save({table:'mari.records.mari.presentation',record_id:`lineage-position:${docId}`,kind:'presentation',source:'mari',title:'Lineage position',text:'',url:'',properties:{document_id:docId,x,y}});},
    unpinNode:async id=>{await save({table:'mari.records.mari.presentation',record_id:`lineage-position:${id}`,kind:'presentation',source:'mari',title:'Lineage position',text:'',url:'',properties:{document_id:id,x:null,y:null}});},
    loadDocHistory:async value=>{const [,id,table]=identity(value);if(!table)throw new Error('Select the node document to read its history');const result=await request<{rows:RecordData[]}>(`/api/history?id=${encodeURIComponent(id)}&table=${encodeURIComponent(table)}`);
      return result.rows.map(r=>({at:date(r),actor:r.actor,verb:(r as any).operation,detail:r.title}));}};
}
