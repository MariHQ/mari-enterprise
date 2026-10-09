import { current, identity, address } from './identity';
import { useSearchParams } from 'react-router-dom';
import type { Decision } from '@mari-design/components/features/DecisionCardFeature';
import type { DecisionsActions, DecisionsData } from '@mari-design/components/pages/DecisionsPage';
import { buildDecisions } from './decisions';
import { randomId, save, useRead, request, type RecordData } from '@mari-app/records';
import type { PageData } from '@mari-app/types';

export function usePlatformDecisions(): PageData<DecisionsData> {
  const [params] = useSearchParams();
  const cursors=params.getAll('after');
  const query=new URLSearchParams({kind:'decision',limit:'40'});
  if(cursors.length)query.set('cursor',cursors[cursors.length-1]);
  const result=useRead<{records:RecordData[];has_more:boolean;next_cursor:string|null}>(`/api/records?${query}`);
  const decisions:Decision[]=(result.data?.records ?? []).map(r=>({
    id:identity(r),statement:r.text,context:r.properties.context ?? '',
    status:({approved:'ratified',ratified:'ratified',rejected:'ignored',superseded:'superseded'} as Record<string,Decision['status']>)[r.properties.status] ?? 'proposed',
    source:r.properties.source_label ?? r.source,provider:r.source,
    owners:r.properties.owner_ids ?? [],decidedOn:r.properties.decided_at,
    impact:{open:false,loading:false,docs:null,tasksCreated:false,count:(r.properties.affected_record_ids ?? []).length,summary:''},
  }));
  const page=(positions:string[])=>{const p=new URLSearchParams();positions.forEach(c=>p.append('after',c));return `/decisions?${p}`;};
  return {loading:result.loading,error:result.error,data:{...buildDecisions(decisions,'all'),
    pagination:{previous:cursors.length?page(cursors.slice(0,-1)):null,
      next:result.data?.next_cursor?page([...cursors,result.data.next_cursor]):null}}};
}

export function platformDecisionActions(ctx:{navigate:(href:string)=>void}): DecisionsActions {
  return {
    capture:async({statement,context,source})=>{
      await save({table:'mari.records.mari.decision',record_id:randomId(),kind:'decision',source:'mari',
        title:statement.slice(0,500),text:statement,url:'',properties:{context,source_label:source,status:'proposed'}});
    },
    ratify:async({id})=>{
      const row=await current(id);
      await save({...row,properties:{...row.properties,status:'ratified',decided_at:new Date().toISOString()}});
    },
    runImpact:async()=>{throw new Error('GRAPH_REQUIREMENTS:Decision → affected Record edges are required for impact analysis.');},
    createImpactTasks:async()=>{throw new Error('GRAPH_REQUIREMENTS:Decision → follow-up Workflow edges are required to create impact tasks.');},
    scan:async()=>{
      await request('/api/temporal/schedules/mine-decisions-daily',{method:'POST',body:JSON.stringify({operation:'trigger'})});
      ctx.navigate('/scheduled-tasks');
    },
  };
}
