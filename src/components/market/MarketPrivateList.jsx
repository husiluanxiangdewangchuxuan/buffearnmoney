import React from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useStockUser } from '@/components/stock/useStockData';
import { Button } from '@/components/ui/button';
import MarketNotice from '@/components/market/MarketNotice';
import WatchButton from '@/components/market/WatchButton';
import { marketError } from '@/components/market/marketClient';
export default function MarketPrivateList({mode}) {
  const {data:user}=useStockUser(),watch=mode==='watch';
  const query=useInfiniteQuery({queryKey:[watch?'market-watch':'market-owned',user?.id],enabled:!!user,initialPageParam:undefined,queryFn:({pageParam})=>(watch?base44.entities.MarketWatch:base44.entities.StockItem).filter({owner_id:user.id},{limit:20,sort:'-created_date',cursor:pageParam}),getNextPageParam:p=>p.has_more?p.next_cursor:undefined});
  const rows=query.data?.pages.flatMap(p=>p.items)||[];
  return <div className="space-y-4"><div className="rounded-xl border bg-card p-4 text-xs leading-6">{watch?'自选已持久保存。当前M1为手动监测：点击商品查看真实报价并刷新；后台定时、阈值提醒和暂停将在M3接入，不宣称已持续后台运行。':'库存保持不变。点击已绑定商品ID的持仓复核当前求购条件；尚未完成单件自动匹配，不显示虚假的可售机会。'}</div><MarketNotice loading={query.isPending} error={query.error?marketError(query.error):null}/>{rows.map(row=><div className="rounded-2xl border bg-card p-5" key={row.id}><h3 className="break-words font-medium">{row.name||`商品 #${row.goods_id}`}</h3><p className="mt-2 text-xs text-muted-foreground">#{row.goods_id||'未绑定BUFF商品ID'}{!watch&&` · 库存 ${row.quantity} 件`}</p><div className="mt-4 grid grid-cols-2 gap-3">{row.goods_id?<Button asChild className="min-h-11"><Link to={`/market/${row.goods_id}?returnTo=${encodeURIComponent(watch?'/watchlist':`/?tab=${mode}`)}`}>查看行情与订单</Link></Button>:<Button asChild variant="outline" className="min-h-11"><Link to="/inventory">补充商品ID</Link></Button>}{watch&&<WatchButton goodsId={row.goods_id} name={row.name} record={row}/>}</div></div>)}{!query.isPending&&!query.error&&!rows.length&&<div className="rounded-2xl border bg-card p-8 text-center text-sm">{watch?'尚未加入自选，可在市场商品卡片加入。':'当前没有库存，仍可切换市场选品浏览真实行情。'}</div>}{query.hasNextPage&&<Button className="min-h-11" disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>加载更多</Button>}</div>;
}