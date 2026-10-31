import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import WatchlistRow from '@/components/market/WatchlistRow';
import MarketNotice from '@/components/market/MarketNotice';
import { marketError } from '@/components/market/marketClient';
export default function WatchlistTable({query,refreshState}) {
  const rows=query.data?.pages.flatMap(page=>page.items)||[];
  return <div className="space-y-4"><MarketNotice loading={query.isPending} error={query.error?marketError(query.error):null}/><section className="overflow-hidden rounded-xl border bg-card"><div className="hidden grid-cols-[minmax(0,1fr)_6rem_7rem_7rem] items-center gap-4 border-b bg-muted/40 px-5 py-3 text-[11px] text-muted-foreground md:grid"><span>皮肤 / 规格</span><span className="text-center">7日走势</span><span className="text-right">最低在售</span><span className="text-right">较收藏涨跌</span></div>{rows.map(({watch,quote})=><WatchlistRow key={watch.id} watch={watch} cachedQuote={quote} refreshState={refreshState}/>)}{!query.isPending&&!query.error&&!rows.length&&<div className="space-y-3 px-5 py-12 text-center"><h2 className="text-sm font-medium">还没有自选皮肤</h2><p className="text-xs text-muted-foreground">在行情页加入自选，开始记录价格变化。</p><Button asChild variant="outline" className="min-h-11"><Link to="/?tab=market">去行情添加自选</Link></Button></div>}</section>{query.hasNextPage&&<Button variant="outline" className="min-h-11 w-full" disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>{query.isFetchingNextPage?'正在读取…':'加载更多自选'}</Button>}</div>;
}