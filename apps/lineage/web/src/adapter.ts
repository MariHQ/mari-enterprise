import { useSearchParams } from 'react-router-dom';
import { useRead, type RecordData } from '@mari-app/records';
import { buildLineage, readView } from './lineage';

type Neighborhood = {records:RecordData[];edges:{record_id:string;from_id:string;to_id:string;relation:string;observed_at:number}[];has_more:boolean;limit:number};
export function usePlatformLineage() {
  const [params]=useSearchParams();
  const focal=params.get('focal')||params.get('trace')||params.get('node');
  const rawLimit=Number(params.get('limit'));
  const limit=Number.isInteger(rawLimit)&&rawLimit>0?Math.min(rawLimit,100):30;
  const result=useRead<Neighborhood>(focal?`/api/lineage?focal=${encodeURIComponent(focal)}&limit=${limit}`:null);
  const nodes=result.data?.records ?? [], edges=result.data?.edges ?? [];
  const date=(row:{observed_at:number})=>new Date(row.observed_at*1000).toISOString().slice(0,10);
  const data=buildLineage({lineage:nodes.map((r,i)=>({id:r.record_id,docId:r.record_id,source:r.source,title:r.title,
    meta:r.kind,icon:'file',x:r.properties.x??((i%5)+1)/6,y:r.properties.y??(Math.floor(i/5)+1)/(Math.ceil(nodes.length/5)+1),
    pinned:r.properties.x!=null,date:date(r),createdDate:date(r),warn:false,owner:r.actor,tags:r.properties.tags||[],staleDays:0,
    orphan:!edges.some(e=>e.from_id===r.record_id||e.to_id===r.record_id),
    inbound:edges.filter(e=>e.to_id===r.record_id).length,outbound:edges.filter(e=>e.from_id===r.record_id).length,docKind:r.kind,group:r.source})),
    lineageEdges:edges.map(r=>({id:r.record_id,fromId:r.from_id,toId:r.to_id,kind:r.relation,date:date(r),meta:null})),
    graphStats:{activity:[]},graphViews:[],settings:[]},{...readView(params),focalId:focal});
  return {...result,loading:!!focal&&result.loading,data:{...data,neighborhood:{focal,limit,hasMore:result.data?.has_more??false}}};
}
