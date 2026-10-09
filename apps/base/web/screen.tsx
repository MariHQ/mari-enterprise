/** Host the original Mari pages and adapters; no replacement page UI. */
import {useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate,useNavigate} from 'react-router-dom';
import type {PageModule} from '@mari-design/components/pages/types';
import {NavProvider} from '@mari-design/components/navigation/Link';
import {Toaster} from '@mari-design/components/feedback/Toast';
import {ReadError} from '@mari-design/components/feedback/ReadError';
import {AuthProvider,useAuth} from './auth';
import {configureApp} from './http';
import {useIsMobile} from './mobile';
import '@mari-app/styles.css';

export function mount(appId:string,pages:PageModule<any,any>[], adapters:Record<string,()=>any>, factories:Record<string,(ctx:any)=>any>) {
  configureApp(appId);
  function Screen({page}:{page:PageModule<any,any>}){
    const navigate=useNavigate();
    const {user,refresh}=useAuth();
    const mobile=useIsMobile();
    const go=(href:string,replace=false)=>{
      const url=new URL(href,location.origin);
      if(url.origin!==location.origin){window.open(url.href,'_blank','noopener,noreferrer');return;}
      if(pages.some(page=>page.route===url.pathname)) navigate(url.pathname+url.search,{replace});
      else if(window.parent!==window)window.parent.postMessage({type:'mari:navigate',href:url.pathname+url.search},location.origin);
    };
      const useData=adapters[page.id],Page=page.component;
        const {data,loading,error}=useData();
        const actions=useMemo(()=>(factories[page.id]||(()=>undefined))({currentUserName:user?.name||'',refresh,navigate:(href:string)=>go(href),replace:(href:string)=>go(href,true)}),[user?.name,refresh,navigate]);
        if(!data)return <ReadError>{error||'Loading…'}</ReadError>;
        return <NavProvider navigate={href=>go(href)}><Page data={data} loading={loading} error={error} actions={actions} mobile={mobile} chrome={{embedded:true,onOpen:href=>go(href),onNavigate:id=>go(pages.find(p=>p.id===id)?.route||`/${id.replace('settings-','settings/')}`)}}/></NavProvider>;
  }
  function Routed(){
    const {loading}=useAuth();
    if(loading)return <ReadError>Loading…</ReadError>;
    return <Toaster><Routes>{pages.map(page=><Route key={page.id} path={page.route} element={<Screen key={page.id} page={page}/>}/>)}<Route path="*" element={<Navigate to={pages[0].route} replace/>}/></Routes></Toaster>;
  }
  createRoot(document.getElementById('root')!).render(<BrowserRouter basename={`/apps/${appId}`}><AuthProvider><Routed/></AuthProvider></BrowserRouter>);
}
