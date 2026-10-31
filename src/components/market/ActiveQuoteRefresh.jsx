import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
export default function ActiveQuoteRefresh() {
  const client=useQueryClient();
  useEffect(()=>{
    let stopped=false,running=false,timer;
    const visible=()=>!stopped&&document.visibilityState==='visible'&&navigator.onLine;
    const schedule=delay=>{clearTimeout(timer);if(visible())timer=setTimeout(tick,delay);};
    async function tick(){
      clearTimeout(timer);if(!visible()||running)return;running=true;
      let delay=60000;
      try {
        const {data}=await base44.functions.invoke('inventoryResearch',{action:'active_tick'});
        if(data.error)throw new Error(data.error);
        delay=Math.max(60000,Math.min(3600000,(Date.parse(data.next_check_at)||Date.now()+3600000)-Date.now()));
        if(data.updated>0)await client.invalidateQueries({predicate:query=>['market-watch','inventory-market','market-catalog','market-owned','market-detail','market-status'].includes(query.queryKey[0])});
      } catch(error) {console.warn('在线报价更新未完成，保留已有数据：',error.message);}
      finally {running=false;schedule(delay);}
    }
    const wake=()=>{clearTimeout(timer);if(visible())void tick();};
    const pause=()=>clearTimeout(timer);
    document.addEventListener('visibilitychange',wake);
    window.addEventListener('online',wake);window.addEventListener('offline',pause);
    window.addEventListener('pageshow',wake);window.addEventListener('pagehide',pause);
    void tick();
    return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);window.removeEventListener('offline',pause);window.removeEventListener('pageshow',wake);window.removeEventListener('pagehide',pause);};
  },[client]);
  return null;
}