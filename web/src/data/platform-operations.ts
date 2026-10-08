import type { ScheduledTasksData, ScheduledTasksActions } from '@mari-design/components/pages/ScheduledTasksPage';
import { request, useRead, type RecordData } from './platform';
import type { PageData } from './types';

type Operations = { records: RecordData[]; observed_at: string; truncated: boolean };
export function usePlatformScheduledTasks(): PageData<ScheduledTasksData> {
  const result=useRead<Operations>('/api/operations');
  const rows=result.data?.records ?? [];
  const runs=rows.filter(r=>r.kind==='temporal_run');
  const tasks=rows.filter(r=>r.kind==='temporal_schedule').map(r=>{
    const p=r.properties;
    const recent=p.recent_runs?.[p.recent_runs.length-1];
    const run=runs.find(item=>item.properties.workflow_id===recent?.workflow_id);
    return {id:p.schedule_id,name:r.title,description:p.retired ? 'Retired schedule. Connector polling runs as a durable workflow; this schedule does not poll.' : `Temporal · ${p.actions ?? 0} scheduled runs · ${p.overlap_skipped ?? 0} overlaps skipped`,status:p.paused?'paused':'active',
      scheduleMinutes:p.interval_seconds?.[0] ? p.interval_seconds[0]/60 : null,
      lastRunNumber:run?.properties.run_id ?? null,lastRunStatus:run?.properties.status?.toLowerCase() ?? '',
      lastRunStarted:run?.properties.started_at ?? recent?.scheduled_at ?? '', nextRunAt:p.next_run,
      retired:Boolean(p.retired), projected:true, sync:p.schedule_id.startsWith('sync-')};
  });
  return {loading:result.loading,error:result.error,data:{tasks,runs:runs.map(r=>({id:r.properties.run_id,name:r.properties.workflow_type,status:r.properties.phase ? `${r.properties.status} · ${r.properties.phase.replaceAll('_',' ')}` : r.properties.status,startedAt:r.properties.started_at,duration:r.properties.duration_seconds ?? null})),observedAt:result.data?.observed_at,
    projectionNote:result.data?.truncated?'Result limit reached. Query the graph for the full history.':undefined}};
}
export function platformScheduledActions(): ScheduledTasksActions {
  const command=(id:string|number,body:Record<string,unknown>)=>request('/api/temporal/schedules/'+encodeURIComponent(id),{method:'POST',body:JSON.stringify(body)});
  return {refresh:()=>window.dispatchEvent(new Event('mari:knowledge-change')),setStatus:async(id,status)=>{await command(id,{operation:status==='active'?'resume':'pause'});},
    setSchedule:async(id,minutes)=>{await command(id,minutes===null?{operation:'pause'}:{operation:'interval',minutes});},
    runNow:async(id)=>{await command(id,{operation:'trigger'});return 'requested';}};
}
