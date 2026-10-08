import { useSearchParams } from 'react-router-dom';
import type { TrajectoryRow, WorkflowsData, WorkflowsActions } from '@mari-design/components/pages/WorkflowsPage';
import { EMPTY } from './workflows';
import { request, save, useRead, type RecordData } from './platform';
import type { ActionContext } from './actions';
import type { PageData } from './types';

function trajectory(row:RecordData,steps:RecordData[]=[]):TrajectoryRow {
  const p=row.properties;
  return {id:row.record_id,sessionId:null,prompt:p.prompt ?? row.title,status:p.status,model:p.model ?? '',
    layer1:'',layer2:'',category:p.actor_id,macroIntent:p.trace_available===false?`Tool history: ${String(p.trace_status ?? 'unavailable').replace(/_/g,' ')}`:'',phases:[],stepCount:p.step_count ?? 0,
    failureCount:p.failure_count ?? 0,reworkCount:p.rework_count ?? 0,startedAt:p.started_at,completedAt:p.finished_at ?? '',
    disposition:p.disposition ?? 'observed',promotedWorkflowId:null,promotedWorkflow:null,
    steps:steps.length?steps.map(s=>({ordinal:s.properties.ordinal,tool:s.properties.tool,actionFamily:s.properties.action_family ?? '',args:s.properties.args ?? {},
      summary:s.properties.summary ?? '',ok:s.properties.status==='completed',disposition:'included',editedArgs:null})):(p.steps ?? []).map((s:any)=>({ordinal:s.ordinal,tool:s.tool,actionFamily:s.action_family,args:s.args ?? {},summary:s.summary ?? '',ok:s.ok,disposition:'included',editedArgs:null})),
    evidence:(p.supporting_record_ids ?? []).map((id:string,index:number)=>({documentId:id,title:id,
      reason:'Referenced by this execution',rank:index,relevance:'observed',note:''}))};
}
export function usePlatformWorkflows():PageData<WorkflowsData> {
  const [params]=useSearchParams();const cursors=params.getAll('after');const id=params.get('trajectory');
  const query=new URLSearchParams({limit:'25'});if(cursors.length)query.set('cursor',cursors[cursors.length-1]);
  if(params.get('status'))query.set('status',params.get('status')!);
  if(params.get('category'))query.set('actor',params.get('category')!);
  const list=useRead<{records:RecordData[];next_cursor:string|null}>(`/api/trajectories?${query}`);
  const focus=useRead<{record:RecordData;steps:RecordData[]}>(id?`/api/trajectory?id=${encodeURIComponent(id)}`:null);
  const rows=(list.data?.records ?? []).map(r=>trajectory(r));
  const page=(positions:string[])=>{const p=new URLSearchParams(params);p.delete('trajectory');p.delete('after');positions.forEach(c=>p.append('after',c));return `/workflows?${p}`;};
  return {loading:list.loading,error:list.error || focus.error || (params.get('tab')==='answers'?'GRAPH_REQUIREMENTS:Approved Answer → originating Run and supporting Record mappings are required.':params.get('q')?'GRAPH_REQUIREMENTS:Query → search matches → Trajectory mapping is required.':null),data:{...EMPTY,tab:params.get('tab')==='answers'?'answers':'observed',observed:{
    ...EMPTY.observed,rows,focused:focus.data?trajectory(focus.data.record,focus.data.steps):null,
    category:params.get('category'),status:params.get('status'),categories:[...new Set(rows.map(r=>r.category))],
    statuses:['running','completed','failed'],pagination:{previous:cursors.length?page(cursors.slice(0,-1)):null,
      next:list.data?.next_cursor?page([...cursors,list.data.next_cursor]):null}}}};
}
export function platformWorkflowActions(ctx:ActionContext):WorkflowsActions {
  const route=(key:string,value:string|null)=>{const p=new URLSearchParams(location.search);value?p.set(key,value):p.delete(key);
    if(key!=='trajectory')p.delete('after');ctx.replace(`/workflows?${p}`);};
  const missing=async()=>{throw new Error('GRAPH_REQUIREMENTS:Trajectory → reusable Workflow or Approved Answer mappings are required for this action.');};
  return {openTrajectory:id=>route('trajectory',id===null?null:String(id)),setCategory:value=>route('category',value),
    setStatusFilter:value=>route('status',value),setSearch:value=>route('q',value),
    setFailures:async()=>{throw new Error('Failure filtering is not connected yet.');},
    setTab:tab=>route('tab',tab),
    promote:missing,promoteToAnswer:missing,
    reject:async(id,rejected)=>{
      const {record}=await request<{record:RecordData}>(`/api/trajectory?id=${encodeURIComponent(id)}`);
      await save({...record,properties:{...record.properties,disposition:rejected?'rejected':'observed'}});
    },
    remove:async(id)=>{
      const {record,steps}=await request<{record:RecordData;steps:RecordData[]}>(`/api/trajectory?id=${encodeURIComponent(id)}`);
      for(const row of [...steps,record])await request(`/api/record?id=${encodeURIComponent(row.record_id)}&table=${encodeURIComponent(row.table)}`,
        {method:'DELETE',headers:{'Idempotency-Key':crypto.randomUUID()}});
      window.dispatchEvent(new Event('mari:knowledge-change'));
    },tuneStep:missing,tuneEvidence:missing,
    harvestCandidates:missing};
}
