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
    case 'settings-general': data={section:'workspace',name:project.name||'',slug:project.slug||'',plan:project.plan||'',timezone:project.timezone||'',language:project.language||'',save:'saved',slugError:null,summary,danger:false,lineage:{maxNodes:config.maxNodes??100,hopDepth:config.hopDepth??2,minConfidence:config.minConfidence??0}};break;
    case 'settings-members': data={members:items('principal'),workspaceName:project.name||'',githubTeam:{team:'',connected:false},summary,interaction:'idle',invite:{name:'',email:'',role:'member'},focusMemberId:null};break;
    case 'settings-models': data={phase:'config',embedding:config.embedding||'',llm:config.llm||'',dims:config.dims||0,embeddingOptions:items('model').filter(m=>m.type==='embedding').map(m=>m.name),llmOptions:items('model').filter(m=>m.type==='llm').map(m=>m.name),chunking:config.chunking||[],keys:{},indexSummary:'',testOk:'',testError:'',summary};break;
    case 'settings-api-keys': data={phase:'list',keys:items('service_principal').map(({secret,...v})=>v),draft:{name:'',scopes:''},newSecret:null,confirmKeyId:null,summary};break;
    case 'settings-audit-log': data={events:rows.filter(r=>r.kind==='change').map((r,i)=>({id:i,at:new Date(r.observed_at*1000).toISOString(),actor:r.actor,action:r.title,target:r.properties.record_ids?.[0]||'',detail:[]})),total:rows.filter(r=>r.kind==='change').length,filter:null,expandedId:null,detail:[],summary};break;
    case 'settings-design':data={branding:first('presentation'),harvest:{},previewStats:[],summary};break;
    case 'preferences': {const prefs=rows.find(r=>r.kind==='preferences'&&r.actor===user?.id)?.properties||{};data={profile:{name:user?.name||'',email:user?.email||'',initials:user?.initials||'',timezone:prefs.timezone||''},provider:user?.provider==='local'?'password':user?.provider,notifications:{mentions:prefs.mentions??false,digest:prefs.digest??false,flowFailures:prefs.flowFailures??false},summary};break;}
    default: data=null;
  }
  return {...result,data,error:result.error||(id==='welcome'?'Connector setup is managed through the Sources application.':null)};
}
export function appPageActions(id:string,ctx:ActionContext){
  const refresh=()=>window.dispatchEvent(new Event('mari:knowledge-change'));
  async function configure(kind:string,properties:Record<string,unknown>){
    await save({table:`mari.records.mari.${kind}`,record_id:`${kind}:workspace`,kind,source:'mari',title:kind,text:'',url:'',properties});refresh();
  }
  if(id==='settings-general')return {saveWorkspace:(value:Record<string,unknown>)=>configure('project',value),saveLineage:(value:Record<string,unknown>)=>configure('configuration',value)};
  return undefined;
}
