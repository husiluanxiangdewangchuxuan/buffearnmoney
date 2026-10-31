import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import QuoteRefreshControl from '@/components/market/QuoteRefreshControl';
import { Button } from '@/components/ui/button';
import MarketNotice from '@/components/market/MarketNotice';
import MarketCard from '@/components/market/MarketCard';
import QuoteChart from '@/components/market/QuoteChart';
import MarketOrders from '@/components/market/MarketOrders';
import MarketResearch from '@/components/market/MarketResearch';
import MarketRequestUsage from '@/components/market/MarketRequestUsage';
import PurchaseScope from '@/components/funds/PurchaseScope';
import { marketCall, marketError } from '@/components/market/marketClient';
import useMarketRefreshState, { acceptMarketSettings } from '@/components/market/useMarketRefreshState';
import MarketRefreshNotice from '@/components/market/MarketRefreshNotice';
export default function MarketDetail() {
  const {goodsId}=useParams(),[params]=useSearchParams(),client=useQueryClient();
  const target=params.get('returnTo')||'/',returnTo=target==='/'||target==='/watchlist'||target.startsWith('/?')?target:'/';
  const valid=/^\d{1,12}$/.test(goodsId);
  const query=useQuery({queryKey:['market-detail',goodsId],enabled:valid,queryFn:()=>marketCall({action:'detail',goods_id:goodsId,source:'manual_detail'}),retry:false,refetchOnWindowFocus:false,staleTime:60000});
  const data=query.data,refreshState=useMarketRefreshState(1,data?.next_allowed_at);
  const historyRefresh=useMutation({mutationKey:['market-refresh',goodsId,'history'],retry:false,mutationFn:days=>marketCall({action:'history',goods_id:goodsId,days,refresh:true,source:'manual_history'}),onSuccess:result=>{acceptMarketSettings(client,result);client.setQueryData(['market-detail',goodsId],result);client.invalidateQueries({queryKey:['market-watch']});},onError:error=>acceptMarketSettings(client,error)});
  useEffect(()=>{acceptMarketSettings(client,query.error||query.data);if(query.data?.quote_fetched_at)client.invalidateQueries({queryKey:['market-watch']});},[query.data,query.error,client]);
  useEffect(()=>{if(valid)return;const meta=document.createElement('meta');meta.name='prerender-status-code';meta.content='404';document.head.append(meta);return()=>meta.remove();},[valid]);
  return <div className="market-surface space-y-5"><div className="flex items-center justify-between gap-3"><Button asChild variant="outline" className="min-h-11"><Link to={returnTo}>{returnTo==='/watchlist'?'返回自选观察':'返回行情列表'}</Link></Button><QuoteRefreshControl data={data} goodsId={valid?goodsId:null}/></div><MarketRefreshNotice state={refreshState}/>{!valid?<p>商品ID无效，请返回行情页重新选择。</p>:<><MarketNotice loading={query.isFetching} error={query.error?marketError(query.error):null} data={data}/>{data&&<><h1 className="break-words text-xl font-bold">{data.item.name}</h1><PurchaseScope showBasket={false}><MarketCard data={data} detail/></PurchaseScope><MarketRequestUsage data={data}/><Button asChild variant="outline" className="min-h-11 w-full"><a href={`https://buff.163.com/s/goods.html?goods_id=${goodsId}&game=csgo`} target="_blank" rel="noreferrer">前往BUFF商品页（非单件订单直达）</a></Button>{historyRefresh.error&&<p role="alert" className="text-xs text-destructive">{marketError(historyRefresh.error)}，已有走势保留。</p>}<QuoteChart series={data.series} updatedAt={data.history_times} busy={historyRefresh.isPending||refreshState.disabled} refreshLabel={refreshState.label} onRefresh={days=>historyRefresh.mutate(days)}/><MarketResearch data={data}/><div className="grid gap-5 xl:grid-cols-2"><MarketOrders key={`sell-${data.batch_id}`} goodsId={goodsId} kind="sell" initial={data.sell} market={data}/><MarketOrders key={`buy-${data.batch_id}`} goodsId={goodsId} kind="buy" initial={data.buy} market={data}/></div></>}</>}</div>;
}