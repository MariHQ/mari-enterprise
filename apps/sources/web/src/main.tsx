import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layers } from 'lucide-react';
import { ConnectorCard, type ConnectorHealth } from '@mari-design/components/data-display/ConnectorCard';
import { SourceMark } from '@mari-design/components/icons/marks';
import { PageHeader } from '@mari-design/components/layout/PageHeader';
import { PropertyList } from '@mari-design/components/data-display/PropertyList';
import { ReadError } from '@mari-design/components/feedback/ReadError';
import { Truncate } from '@mari-design/components/data-display/Truncate';
import { SectionLabel } from '@mari-design/components/forms/SectionLabel';
import { card } from '@mari-design/components/tokens/card';
import { fmtDateTime } from '@mari-design/components/tokens/format';
import './styles.css';

type Source = {id:string; provider:string; name:string; mode:string; target?:string;
  intervalSeconds?:number; observedAt?:number; endpoint?:string; discovery?:string};
type Result = {sources:Source[]; warnings:string[]};
// Original Sources page composition: connector gallery and 320px supporting rail.
// ConnectorCard is the original library primitive, with no mutation callbacks.
function Sources() {
  const [data,setData]=useState<Result>({sources:[],warnings:[]});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    let controller:AbortController|undefined;
    const receive=async(event:MessageEvent)=>{
      if(event.source!==window.parent || event.origin!==window.location.origin || event.data?.type!=='mari:app-grant' || event.data.app!=='sources')return;
      controller?.abort(); controller=new AbortController();
      try {
        const response=await fetch('/apps/sources/api/status',{headers:{Authorization:`Bearer ${event.data.grant}`},signal:controller.signal});
        const body=await response.json();
        if(!response.ok)throw new Error(body.detail || 'Source query failed');
        setData(body);setError(null);setLoading(false);
      } catch(e) {if(!(e instanceof DOMException && e.name==='AbortError')){setError(e instanceof Error?e.message:String(e));setLoading(false);}}
    };
    window.addEventListener('message',receive);
    window.parent.postMessage({type:'mari:app-ready',app:'sources'},window.location.origin);
    return ()=>{controller?.abort();window.removeEventListener('message',receive);};
  },[]);
  const providers=['github','slack'];
  return <main className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
    <PageHeader eyebrow="Knowledge ingestion" title="Sources & connectors"
      description="Bring every product conversation into one trusted library."
      icon={<span className="text-moss"><Layers size={24}/></span>}/>
    <div className="mt-6 grid grid-cols-1 min-[900px]:grid-cols-[minmax(0,1fr)_320px] gap-5">
      <div className="min-w-0 flex flex-col gap-5">
        {error && <ReadError>{error}</ReadError>}
        {data.warnings.map(w=><ReadError key={w}>{'GRAPH_REQUIREMENTS:'+w}</ReadError>)}
        <div className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-[260px]">
          {loading ? providers.map(provider=><ConnectorCard key={provider} name={provider==='github'?'GitHub':'Slack'} mark={<SourceMark provider={provider} size={26}/>} loading/>) : data.sources.map(s=><ConnectorCard key={s.id}
            name={s.name} mark={<SourceMark provider={s.provider} size={26}/>}
            health={'Unknown' as ConnectorHealth}
            counts={s.mode==='webhook'?'Signed webhook':'Temporal polling'}
            sync={<div className="min-w-0 space-y-1">
              {s.target && <Truncate>{s.target}</Truncate>}
              {s.endpoint && <Truncate>{s.endpoint}</Truncate>}
              {s.intervalSeconds!=null && <p>Every {s.intervalSeconds/60} minutes</p>}
              {s.observedAt && <p>Configuration observed: {fmtDateTime(new Date(s.observedAt*1000).toISOString())}</p>}
              {s.discovery==='joined_channels' && <p>Discovers channels the bot has joined.</p>}
            </div>}
            barsNote="Activity requires Connector → ingested Record; health requires Workflow → Run."/>) }
        </div>
      </div>
      <aside className="min-w-0 flex flex-col gap-5">
        <div className={`${card} p-4`}><SectionLabel>At a glance</SectionLabel>
          <PropertyList boxed={false} loading={loading} items={[
            {label:'GitHub',value:error?'Unavailable':data.sources.filter(s=>s.provider==='github'&&s.mode==='polling').length+' repositories'},
            {label:'Slack',value:error?'Unavailable':data.sources.filter(s=>s.provider==='slack'&&s.mode==='polling').length+' channels'},
          ]}/>
        </div>
        <div className={`${card} p-4`}><SectionLabel>Connection details</SectionLabel>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink/70">Source configuration is shown here for reference. Credentials stay on the server.</p>
        </div>
      </aside>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Sources/>);
