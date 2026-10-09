import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Boxes, Database, Layers, LogOut, ArrowLeft } from 'lucide-react';
import {PageFrame,NAV,landingPageFor} from '@mari-design/components/pages/PageFrame';
import { AppShell } from '@mari-design/components/shell/AppShell';
import { Sidebar } from '@mari-design/components/shell/Sidebar';
import { HeaderBar } from '@mari-design/components/shell/HeaderBar';
import { Logo, Brandmark } from '@mari-design/components/shell/Logo';
import { PageHeader } from '@mari-design/components/layout/PageHeader';
import { Card } from '@mari-design/components/layout/Card';
import { CardBody, CardActions } from '@mari-design/components/layout/CardShell';
import { Button } from '@mari-design/components/actions/Button';
import { Field } from '@mari-design/components/forms/Field';
import { Input } from '@mari-design/components/forms/Input';
import { Alert } from '@mari-design/components/feedback/Alert';
import { Truncate } from '@mari-design/components/data-display/Truncate';
import { Spinner } from '@mari-design/components/data-display/Spinner';
import '@mari-app/styles.css';

type App = {id:string;name:string;description:string;icon:string;path:string;routes:string[]};
type User = {sub:string;name:string;provider:string};
type Auth = {title:string;local:boolean;oidc:boolean;oidcLabel:string};
async function api(path:string, body?:unknown) {
  const response=await fetch(path, body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Mari-CSRF':'1'},body:JSON.stringify(body)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.detail||'The request could not be completed.');
  return data;
}
const iconFor=(icon:string)=>icon==='sources'?<Layers size={18}/>:icon==='knowledge'?<Database size={18}/>:<Boxes size={18}/>;

function Container() {
  const [auth,setAuth]=useState<Auth|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [apps,setApps]=useState<App[]>([]);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState(new URLSearchParams(location.search).has('auth_error')?'Single sign-on did not complete. Please try again.':'');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [active,setActive]=useState(location.hash.slice(1)||'/');
  const [frameVersion,setFrameVersion]=useState(0);
  const [mobile,setMobile]=useState(innerWidth<760);
  const [appError,setAppError]=useState('');
  const [frameReady,setFrameReady]=useState(false);
  const route=new URL(active.startsWith('/')?active:'/',location.origin);
  const selected=apps.find(a=>a.id===active)||apps.find(a=>a.routes.includes(route.pathname));
  const framePath=selected?selected.path.replace(/\/$/,'')+(selected.routes.includes(route.pathname)?route.pathname+route.search:selected.routes[0]):'';
  useEffect(()=>{
    const controller=new AbortController();setFrameReady(false);setAppError('');
    if(selected&&user)fetch(selected.path,{signal:controller.signal}).then(async response=>{
      if(response.status===401){setUser(null);return;}
      if(!response.ok){const body=await response.json();throw new Error(body.detail||'The application is unavailable.');}
      setFrameReady(true);
    }).catch(e=>{if(e.name!=='AbortError')setAppError(e.message);});
    return()=>controller.abort();
  },[selected?.id,user?.sub,frameVersion]);
  useEffect(()=>{
    const resize=()=>setMobile(innerWidth<760); const hash=()=>{setActive(location.hash.slice(1)||'/');setAppError('');};
    addEventListener('resize',resize);addEventListener('hashchange',hash);
    return ()=>{removeEventListener('resize',resize);removeEventListener('hashchange',hash);};
  },[]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      const frame=document.querySelector('iframe');
      if(event.origin!==location.origin||event.source!==frame?.contentWindow||event.data?.type!=='mari:navigate')return;
      const href=String(event.data.href||'');
      if(href.startsWith('/')&&!href.startsWith('//'))location.hash=href;
    };
    addEventListener('message',receive);return()=>removeEventListener('message',receive);
  },[]);
  async function loadSession() {
    const response=await fetch('/auth/me');
    if(response.status===401){setUser(null);setApps([]);return;}
    if(!response.ok)throw new Error('Your session could not be loaded.');
    const session=await response.json();setUser(session.user);
    setApps((await api('/api/apps')).apps);
  }
  useEffect(()=>{Promise.all([api('/auth/config').then(setAuth),loadSession()]).catch(e=>setError(e.message)).finally(()=>setBusy(false));},[]);
  // Recheck the host session so an expired session removes authenticated frames.
  useEffect(()=>{if(!user)return;const timer=setInterval(()=>{loadSession().catch(()=>{});},60000);return()=>clearInterval(timer);},[user?.sub]);
  async function login(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await api('/auth/login',{username,password});setPassword('');await loadSession();history.replaceState(null,'',location.pathname);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function logout(){try{await api('/auth/logout',{});setUser(null);setApps([]);location.hash='';}catch(e){setError((e as Error).message);}}
  function navigate(id:string){const item=apps.find(a=>a.id===id);location.hash=item?.routes[0]||'/';setAppError('');}
  if(!auth)return <main className="p-8"><Logo/><div className="mt-6">{error?<Alert tone="blocked">{error}</Alert>:<p role="status">Loading workspace…</p>}</div></main>;
  if(!user)return <main className="min-h-dvh bg-flysch/40 px-5 py-12 font-display"><div className="mx-auto max-w-[1400px]"><div className="mx-auto w-full max-w-[440px] flex flex-col gap-5"><Logo/>
    <PageHeader title="Sign in" description={auth.title}/>
    <Card><CardBody>
      {error&&<Alert tone="blocked">{error}</Alert>}
      {auth.local&&<form onSubmit={login}><Field label="Username"><Input className="w-full" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></Field><Field label="Password"><Input className="w-full" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></Field><div className="mt-5"><Button type="submit" variant="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</Button></div></form>}
      {auth.oidc&&<Button onClick={()=>{location.href='/auth/oidc/login';}}>Continue with {auth.oidcLabel}</Button>}
      {!auth.local&&!auth.oidc&&<Alert tone="attention">No sign-in method is available. Contact your workspace administrator.</Alert>}
    </CardBody></Card>
  </div></div></main>;
  const missing=NAV.flatMap(section=>section.items||[]).filter(item=>!apps.some(a=>a.id===item.id)).map(item=>item.id);
  return <PageFrame active={selected?.id||'overview'} title={selected?.name||auth.title} mobile={mobile} chrome={{hiddenNavIds:missing,user:{name:user.name,initials:user.name.slice(0,2).toUpperCase(),detail:user.provider},onSignOut:logout,onNavigate:navigate,onOpen:href=>{location.hash=href;}}}>
    {error&&<div className="p-4"><Alert tone="blocked" onDismiss={()=>setError('')}>{error}</Alert></div>}
    {selected?<div className="flex h-full min-h-[400px] flex-col">{appError?<div className="p-5"><Alert tone="attention">{appError}</Alert><Button onClick={()=>setFrameVersion(v=>v+1)}>Retry</Button></div>:!frameReady?<p className="p-5 text-[13px] text-ink/70" role="status">Opening {selected.name}…</p>:<iframe key={selected.id+frameVersion} title={selected.name} src={framePath} className="min-h-0 w-full flex-1 border-0 bg-paper" onError={()=>setAppError('The application could not be loaded.')}/>}</div>:<div className="p-5"><Alert tone="attention">This application is not configured.</Alert></div>}
  </PageFrame>;
}
createRoot(document.getElementById('root')!).render(<Container/>);
