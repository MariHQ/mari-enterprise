import {useEffect,useState} from 'react';
import {authenticatedFetch,projectHeaders} from './http';
export type RecordData = {
  table: string; record_id: string; event_id: string; kind: string; source: string; title: string;
  text: string; url: string; actor: string; observed_at: number;
  properties: Record<string, any>;
};
const pending = new Map<string, string>();
const drafts = new Map<string, RecordData>();
const recordTables = new Map<string, string>();
const refresh = () => window.dispatchEvent(new Event('mari:knowledge-change'));
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, { signal: AbortSignal.timeout(40000), ...init, headers: { 'Content-Type': 'application/json', ...projectHeaders(), ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
  return data as T;
}
export function useRead<T>(path: string | null) {
  const [state, setState] = useState<{data:T|null;loading:boolean;error:string|null}>({data:null,loading:true,error:null});
  useEffect(() => {
    let active = true; let generation=0;
    const load = () => {
      const requestGeneration=++generation;
      if (!path) { setState({data:null,loading:false,error:null}); return; }
      request<T>(path).then(data => {
        if(active && requestGeneration===generation) {
          const rows=(data as {records?:RecordData[]})?.records ?? [];
          for(const row of rows)if(pending.get(row.record_id)===row.event_id){pending.delete(row.record_id);drafts.delete(row.record_id);}
          setState({data,loading:false,error:null});
        }
      })
        .catch(error => { if(active && requestGeneration===generation) setState(s=>({...s,loading:false,error:error.message})); });
    };
    setState({data:null,loading:true,error:null}); load();
    const timer = window.setInterval(() => { if(pending.size) load(); },3000);
    window.addEventListener('mari:knowledge-change',load);
    return () => { active=false; clearInterval(timer); window.removeEventListener('mari:knowledge-change',load); };
  },[path]);
  return state;
}
export async function current(id:string|number) {return request<RecordData>(`/api/record?id=${encodeURIComponent(id)}`);}
export async function save(row:Partial<RecordData>,requestId: string=crypto.randomUUID()) {
  const {event_id,observed_at,actor,...body}=row;
  const result=await request<{event_id:string;record_id:string}>('/api/records',{method:'POST',headers:{'Idempotency-Key':requestId},
    body:JSON.stringify({...body,expected_revision:event_id})});
  pending.set(result.record_id,result.event_id);
  drafts.set(result.record_id,{...row,record_id:result.record_id,event_id:result.event_id,observed_at:Math.floor(Date.now()/1000),actor:'Owner'} as RecordData);
  refresh();return result;
}

export {pending,drafts,recordTables};
