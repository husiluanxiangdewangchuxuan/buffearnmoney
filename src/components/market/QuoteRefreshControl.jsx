import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { marketCall, marketError, time } from '@/components/market/marketClient';
import useMarketRefreshState, { acceptMarketSettings } from '@/components/market/useMarketRefreshState';
export default function QuoteRefreshControl({data,goodsId,source='manual_detail'}) {
  const client=useQueryClient(),at=data?.quote_fetched_at||data?.fetched_at;
  const next=data?.next_allowed_at||(at?new Date(Date.parse(at)+3600000).toISOString():null),state=useMarketRefreshState(1,next);
  const refresh=useMutation({mutationKey:['market-refresh',String(goodsId)],retry:false,mutationFn:()=>marketCall({action:'quote',goods_id:String(goodsId),refresh:true,source}),onSuccess:async result=>{acceptMarketSettings(client,result);client.setQueryData(['market-detail',String(goodsId)],result);await Promise.all(['market-watch','inventory-market','market-catalog','market-owned'].map(key=>client.invalidateQueries({queryKey:[key]})));},onError:error=>acceptMarketSettings(client,error)});
  const latest=[refresh.data,data].filter(Boolean).sort((a,b)=>(Date.parse(b.quote_fetched_at||b.fetched_at)||0)-(Date.parse(a.quote_fetched_at||a.fetched_at)||0))[0],quoteAt=latest?.quote_fetched_at||latest?.fetched_at;
  return <div className="space-y-1 text-xs"><Button variant="outline" className="min-h-11 text-xs" disabled={!goodsId||refresh.isPending||state.disabled} onClick={()=>refresh.mutate()}>{refresh.isPending?'更新中…':state.label||(quoteAt?'更新报价':'获取首次报价')}</Button><p className="text-muted-foreground">{quoteAt?`报价截至 ${new Date(quoteAt).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false})}`:'暂无报价'}</p>{state.nextAttemptAt&&state.disabled&&<p className="text-muted-foreground">下次可尝试时间：{time(state.nextAttemptAt)}</p>}{refresh.error&&<p role="alert" className="text-destructive">{marketError(refresh.error)}；保留上次数据。</p>}{latest?.refresh_errors?.length>0&&<p role="alert" className="text-destructive">{latest.refresh_errors.map(error=>error.message).join('；')}；保留历史。</p>}</div>;
}