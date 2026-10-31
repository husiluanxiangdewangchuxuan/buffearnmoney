import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import WatchlistTable from '@/components/market/WatchlistTable';
import useWatchlist from '@/components/market/useWatchlist';
import PurchaseScope from '@/components/funds/PurchaseScope';
import useMarketRefreshState from '@/components/market/useMarketRefreshState';
import MarketRefreshNotice from '@/components/market/MarketRefreshNotice';
export default function Watchlist() {
  const client=useQueryClient(),query=useWatchlist(),busy=query.isFetching,refreshState=useMarketRefreshState(1);
  return <div className="market-surface space-y-5"><div className="flex items-center justify-between gap-3"><div><p className="mb-1 text-[10px] tracking-widest text-muted-foreground">WATCHLIST</p><h1 className="text-xl font-bold">自选观察</h1></div><Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>client.invalidateQueries({queryKey:['market-watch']})}>{busy?'读取中…':'刷新清单缓存'}</Button></div><p className="text-xs leading-6 text-muted-foreground"><span className="text-market-up">红涨</span> / <span className="text-market-down">绿跌</span> · 涨跌以最低在售对比加入自选时的参考价，不是24小时涨跌或持仓盈亏。旧自选未记录基准时不补造价格。</p><MarketRefreshNotice state={refreshState}/><PurchaseScope showBasket={false}><WatchlistTable query={query} refreshState={refreshState}/></PurchaseScope><p className="text-[11px] leading-5 text-muted-foreground">清单读取已有行情；仅App前台在线时，每60分钟错峰更新关注商品，无人使用不采集。点击单款“更新报价”仅查询一次基础在售报价；7/30日走势与订单明细打开详情再加载；超过60分钟的报价标为历史并继续保留。求购仅为已核实首屏通用参考，非全市场最高价；图片为商品示意图，非单件实物。</p></div>;
}