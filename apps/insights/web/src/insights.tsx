import {RunCards} from '@mari-app/run-statistics';
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
    case 'insights': data={statistics:<RunCards/>,widgets:result.data?{stats:Object.entries(result.data.metrics||{}).map(([label,value])=>({key:label,label:({documents:'Source records',facts:'Facts',decisions:'Decisions',entities:'Entities',evidence:'Evidence snapshots'} as Record<string,string>)[label]||label,value,tone:'info',icon:'search'})),readability:[],glossary:[],activity:[],readabilityAvailable:false,glossaryAvailable:false,periodLabel:'Current knowledge coverage. Extracted claims include candidates awaiting review.',since:new Date().toISOString()}:null,freshness:null,extras:null};break;
    default: data=null;
  }
  return {...result,loading:false,data,error:result.error||(id==='welcome'?'Connector setup is managed through the Sources application.':null)};
}
export function appPageActions(id:string,ctx:ActionContext){
  const refresh=()=>window.dispatchEvent(new Event('mari:knowledge-change'));
  async function configure(kind:string,properties:Record<string,unknown>){
    await save({table:`mari.records.mari.${kind}`,record_id:`${kind}:workspace`,kind,source:'mari',title:kind,text:'',url:'',properties});refresh();
  }
  return undefined;
}
