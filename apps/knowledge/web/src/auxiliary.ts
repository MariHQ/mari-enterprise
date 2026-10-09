/** Data adapters for original presenters. Values come from graph records, never preview fixtures. */
import {useSearchParams} from 'react-router-dom';
import {useAuth} from '@mari-app/auth';
import {useRead,save} from '@mari-app/records';
import type {RecordData} from '@mari-app/records';
import type {ActionContext} from '@mari-app/types';

export function useAppPage(id:string){
  const [params]=useSearchParams();
  const result=useRead<{records:RecordData[];truncated:boolean;metrics?:Record<string,number>}>(`/api/pages/${id}`);
  const {user}=useAuth();
  const rows=result.data?.records||[];
  const first=(kind:string)=>rows.find(row=>row.kind===kind)?.properties||{};
  const items=(kind:string):Record<string,any>[]=>rows.filter(row=>row.kind===kind).map(row=>({...row.properties,id:row.record_id}));
  const summary=result.data?.truncated?[{label:'Results',value:'First 100 records'}]:[];
  const config=first('configuration'),project=first('project');
  let data:any;
  switch(id){
    case 'library':data={tab:params.get('tab')||'tags',tags:config.tags||[],totalDocs:result.data?.metrics?.documents||0,checkerDocs:[],workspace:project.name||'',terms:config.terms||[],guides:config.guides||[],defaultPack:config.defaultPack||'',voice:config.voice||{},templates:config.templates||[],counts:{tags:0,rules:0,glossary:0,guides:0,templates:0}};break;
    case 'audit':data={repo:'',provider:'',ranAt:null,summary:'',findings:items('finding'),members:[],banner:null,history:items('review'),scans:[],extras:null};break;
    default: data=null;
  }
  return {...result,data,error:result.error||(id==='welcome'?'Connector setup is managed through the Sources application.':null)};
}
export function appPageActions(id:string,ctx:ActionContext){
  const refresh=()=>window.dispatchEvent(new Event('mari:knowledge-change'));
  async function configure(kind:string,properties:Record<string,unknown>){
    await save({table:`mari.records.mari.${kind}`,record_id:`${kind}:workspace`,kind,source:'mari',title:kind,text:'',url:'',properties});refresh();
  }
  return undefined;
}
