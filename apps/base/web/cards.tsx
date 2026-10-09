/** Mount queries near the viewport; cards own loading/error state independently. */
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useRead} from './records';
export function QueryCard<T>({path,children}:{path:string;children:(state:ReturnType<typeof useRead<T>>)=>ReactNode}){
  const ref=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(false);
  useEffect(()=>{const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'160px'});if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[]);
  const result=useRead<T>(visible?path:null);
  return <div ref={ref} className="min-w-0" aria-busy={!visible||result.loading}>{children({...result,loading:!visible||result.loading})}</div>;
}
