import { useEffect, useState } from 'react';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import { marketCall } from '@/components/market/marketClient';
export function acceptMarketSettings(client,result) {
  const data=result?.response?.data||result?.data||result;
  if(data?.settings)client.setQueryData(['market-status'],data.settings);
}
export default function useMarketRefreshState(required=1,nextAllowed=null) {
  const [now,setNow]=useState(Date.now),active=useIsMutating({mutationKey:['market-refresh']});
  const query=useQuery({queryKey:['market-status'],queryFn:()=>marketCall({action:'status'}),staleTime:15000,retry:false,refetchOnWindowFocus:true});
  const settings=query.data,until=Math.max(Date.parse(settings?.retry_at)||0,Date.parse(nextAllowed)||0),waiting=(Date.parse(settings?.retry_at)||0)>now,windowWait=(Date.parse(nextAllowed)||0)>now;
  useEffect(()=>{setNow(Date.now());if(!Number.isFinite(until)||until<=Date.now())return;const timer=setTimeout(()=>setNow(Date.now()),Math.min(until-Date.now()+50,2147483647));return()=>clearTimeout(timer);},[until]);
  const requiredCalls=settings?.recovery_pending?1:required;
  const budgetBlocked=settings?.remaining_budget!=null&&settings.remaining_budget<requiredCalls;
  return {settings,waiting,windowWait,nextAttemptAt:until>now?new Date(until).toISOString():null,busy:active>0,budgetBlocked,requiredCalls,disabled:waiting||windowWait||active>0||budgetBlocked,label:waiting?'等待下次尝试':active?'采集中…':windowWait?'未到下轮时间':budgetBlocked?'本应用预算不足':null};
}