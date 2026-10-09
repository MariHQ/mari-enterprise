import {setLineageRelations} from '@mari-design/components/features/LineageDataModel';
import { useSearchParams } from 'react-router-dom';
import { useRead, type RecordData } from '@mari-app/records';
import { buildLineage, readView } from './lineage';

type Catalog = {revision:number;nodes:{label:string;properties:{name:string;type:string}[]}[];edges:{label:string}[]};
type Neighborhood = {focal:string|null;catalog:Catalog;records:(RecordData & {node_type:string})[];edges:{record_id:string;from_id:string;from_type:string;to_id:string;to_type:string;relation:string;observed_at:number}[];has_more:boolean;limit:number};
export function usePlatformLineage() {
  const [params]=useSearchParams();
  const rawFocal=params.get('focal')||params.get('trace')||params.get('node');
  let focal=rawFocal,nodeType=params.get('node_type');
  if(rawFocal?.startsWith('[')){try{[nodeType,focal]=JSON.parse(rawFocal);}catch{}}
  const identity=(type:string,id:string)=>JSON.stringify([type,id]);
  const rawLimit=Number(params.get('limit'));
  const limit=Number.isInteger(rawLimit)&&rawLimit>0?Math.min(rawLimit,100):30;
  const result=useRead<Neighborhood>(`/api/lineage?limit=${limit}${focal?'&focal='+encodeURIComponent(focal):''}${nodeType?'&node_type='+encodeURIComponent(nodeType):''}${params.get('relation')?'&relation='+encodeURIComponent(params.get('relation')!):''}`);
  const selected=focal&&nodeType?identity(nodeType,focal):result.data?.focal&&result.data?.records.length?identity(result.data.records[0].node_type,result.data.focal):null;
  setLineageRelations(result.data?.edges.map(e=>e.relation)??[]);
  const parameters=(r:RecordData & {node_type:string})=>{const fields=result.data?.catalog.nodes.find(n=>n.label===r.node_type)?.properties??[];return [...fields.filter(f=>!['text','properties'].includes(f.name)&&(f.name in r||f.name in r.properties)).map(f=>({...f,value:String((r as any)[f.name]??r.properties[f.name]??'')})),...Object.entries(r.properties).filter(([key])=>!fields.some(f=>f.name===key)).map(([name,value])=>({name,type:typeof value,value:typeof value==='string'?value:JSON.stringify(value)}))];};
  const nodes=result.data?.records ?? [], edges=result.data?.edges ?? [];
  const date=(row:{observed_at:number})=>new Date(row.observed_at*1000).toISOString().slice(0,10);
  const data=buildLineage({lineage:nodes.map((r,i)=>({id:identity(r.node_type,r.record_id),docId:JSON.stringify([r.node_type,r.record_id,r.table]),source:r.source,title:r.title,
    parameters:parameters(r),meta:r.kind,icon:'file',x:r.properties.x??((i%5)+1)/6,y:r.properties.y??(Math.floor(i/5)+1)/(Math.ceil(nodes.length/5)+1),
    pinned:r.properties.x!=null,date:date(r),createdDate:date(r),warn:false,owner:r.actor,tags:r.properties.tags||[],staleDays:0,
    orphan:!edges.some(e=>(e.from_type===r.node_type&&e.from_id===r.record_id)||(e.to_type===r.node_type&&e.to_id===r.record_id)),
    inbound:edges.filter(e=>e.to_type===r.node_type&&e.to_id===r.record_id).length,outbound:edges.filter(e=>e.from_type===r.node_type&&e.from_id===r.record_id).length,docKind:r.kind,group:r.source})),
    lineageEdges:edges.map(r=>({id:r.record_id,fromId:identity(r.from_type,r.from_id),toId:identity(r.to_type,r.to_id),kind:r.relation,date:date(r),meta:null})),
    graphStats:{activity:[]},graphViews:[],settings:[]},{...readView(params),focalId:selected});
  return {...result,loading:result.loading,data:{...data,neighborhood:{focal:selected,limit,hasMore:result.data?.has_more??false}}};
}
