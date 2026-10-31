import React, { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import MarketHeader from '@/components/market/MarketHeader';
import MarketFunds from '@/components/market/MarketFunds';
import MarketHistoryAccess from '@/components/market/MarketHistoryAccess';
import MarketPrivateList from '@/components/market/MarketPrivateList';
import PurchaseScope from '@/components/funds/PurchaseScope';
import MarketScan from '@/components/market/scan/MarketScan';

export default function Opportunities() {
  const [params,setParams]=useSearchParams(),[refreshKey,setRefreshKey]=useState(0),client=useQueryClient();
  const tab=params.get('tab')||'market',busy=useIsFetching({queryKey:['market-catalog']})>0;
  const selectTab=value=>{const next=new URLSearchParams(params);next.set('tab',value);setParams(next);};
  const refresh=()=>{if(tab==='market'){setRefreshKey(k=>k+1);client.invalidateQueries({queryKey:['market-history']});client.invalidateQueries({queryKey:['market-history-count']});}else if(tab==='scan'){client.invalidateQueries({queryKey:['market-scan']});client.invalidateQueries({queryKey:['market-scan-results']});}else client.invalidateQueries({queryKey:[tab==='watch'?'market-watch':'market-owned']});client.invalidateQueries({queryKey:['market-status']});};
  if(tab==='watch')return <Navigate to="/watchlist" replace/>;
  return <div className="market-surface space-y-5"><MarketHeader onRefresh={refresh} busy={busy}/><MarketFunds/><div role="tablist" className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[['owned','我的库存出售'],['market','市场选品'],['scan','扫描管理']].map(([key,label])=><Button role="tab" aria-selected={tab===key} className="min-h-11 whitespace-normal px-2 text-xs sm:text-sm" key={key} variant={tab===key?'default':'outline'} onClick={()=>selectTab(key)}>{label}</Button>)}</div>{tab==='market'?<PurchaseScope><MarketHistoryAccess refreshKey={refreshKey}/></PurchaseScope>:tab==='scan'?<MarketScan/>:<MarketPrivateList key={tab} mode={tab}/>}<p className="text-xs leading-6 text-muted-foreground">研究报价不等于可成交价格。交易保护、费用与单件条件必须人工复核；不承诺未来上涨，不自动交易。</p></div>;
}