import {useRead,type RecordData} from '@mari-app/records';
import {EMPTY as emptySources} from './sources';
import type {SourcesData} from '@mari-design/components/pages/SourcesPage';
import type {PageData} from '@mari-app/types';
type Operations={records:RecordData[];observed_at:string;truncated:boolean};
export function mapConnectorProjection(result:Operations): NonNullable<SourcesData['projection']> {
  const runs=result.records.filter(r=>r.kind==='temporal_run').sort((a,b)=>String(b.properties.started_at ?? '').localeCompare(String(a.properties.started_at ?? '')));
  type Connector = NonNullable<SourcesData['projection']>['connectors'][number];
  const groups=new Map<string,Connector>();
  const rows=result.records.filter(r=>r.kind==='temporal_connector'||r.kind==='webhook_connector');
  for(const row of rows){
    const p=row.properties,provider=String(p.provider ?? row.record_id);
    let group=groups.get(provider);
    if(!group){group={id:provider,name:provider==='slack'?'Slack':provider==='github'?'GitHub':provider,provider,targets:[],webhooks:[]};groups.set(provider,group);}
    if(p.mode==='webhook'){
      if(p.endpoint && !group.webhooks.includes(String(p.endpoint)))group.webhooks.push(String(p.endpoint));
      continue;
    }
    const targets=Array.isArray(p.targets)?p.targets:[p];
    for(const target of targets){
      if(!target.target)continue;
      const key=String(target.target);
      if(group.targets.some(t=>t.target===key))continue;
      const run=runs.find(run=>run.properties.workflow_id===target.workflow_id);
      const phase=run?.properties.phase;
      const activity=run && result.records.find(a=>a.kind==='temporal_activity' && a.properties.run_id===run.properties.run_id && a.properties.error);
      group.targets.push({target:key,workflowId:target.workflow_id,status:run?.properties.status,
        phase:typeof phase==='string'?phase:phase?.phase,
        error:run?.properties.error ?? activity?.properties.error ?? (typeof phase==='object'?phase?.last_error:undefined),
        intervalSeconds:target.interval_seconds});
    }
  }
  return {observedAt:result.observed_at,truncated:result.truncated,connectors:[...groups.values()]};
}
export function usePlatformSources(): PageData<SourcesData> {
  const result=useRead<Operations>('/api/connectors');
  return {loading:result.loading,error:result.error,data:{...emptySources,
    projection:result.data?mapConnectorProjection(result.data):{connectors:[],observedAt:'',truncated:false}}};
}
