import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useMarketRefreshState, { acceptMarketSettings } from '@/components/market/useMarketRefreshState';
import { Button } from '@/components/ui/button';
import MarketNotice from '@/components/market/MarketNotice';
import MarketImage from '@/components/market/MarketImage';
import MarketBuyList from '@/components/market/MarketBuyList';
import { marketCall, marketError, price, time } from '@/components/market/marketClient';
export default function MarketOrders({goodsId,kind,initial,market}) {
  const [page,setPage]=useState(1),[pages,setPages]=useState({}),client=useQueryClient(),state=useMarketRefreshState(1,market?.next_allowed_at);const sell=kind==='sell';
  const refresh=useMutation({mutationKey:['market-refresh',goodsId,kind,page],retry:false,mutationFn:()=>marketCall({action:'orders',goods_id:goodsId,kind,page,refresh:true,source:'manual_orders'}),onSuccess:result=>{acceptMarketSettings(client,result);if(result.order_page)setPages(previous=>({...previous,[result.order_page.page]:result.order_page}));client.setQueryData(['market-detail',goodsId],result);},onError:error=>acceptMarketSettings(client,error)});
  const query=useQuery({queryKey:['market-orders',goodsId,kind,page],enabled:page>1,queryFn:()=>marketCall({action:'orders',goods_id:goodsId,kind,page}),retry:false,refetchOnWindowFocus:false,staleTime:60000});
  const data=pages[page]||(page===1?initial:query.data),items=data?.items||[],size=sell?10:5;
  return <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5">
    <h2 className="font-semibold">{sell?'单件在售':'求购列表'}</h2><p className="mt-2 text-xs text-muted-foreground">明细更新于 {time(data?.fetched_at)}；翻页只读已存数据。</p><Button className="mt-3 min-h-11" variant="outline" disabled={refresh.isPending||state.disabled} onClick={()=>refresh.mutate()}>{refresh.isPending?'更新中…':state.label||`更新此页${sell?'在售':'求购'}明细`}</Button>{refresh.error&&<p role="alert" className="mt-2 text-xs text-destructive">{marketError(refresh.error)}；已有明细保留。</p>}
    <p className="my-3 text-xs leading-5 text-muted-foreground">第{page}页实际返回{items.length}条 / 上游总数{data?.total??'未提供'}。{sell?'最低报价排序。':'当前页不是全部市场。'}</p>
    <MarketNotice loading={query.isFetching} error={query.error?marketError(query.error):null}/>
    {!sell?<MarketBuyList items={items}/>:<div className="space-y-3">{items.map(o=><div key={o.id} className="rounded-xl border p-4 text-xs leading-6">
      <div className="flex items-center justify-between gap-3"><strong className="text-base">{price(o.price_cents)}</strong>{o.inspect_url?<a className="text-primary underline" href={o.inspect_url} target="_blank" rel="noreferrer">查看单件检视</a>:<span className="text-muted-foreground">无检视链接</span>}</div>
      <p className="break-all text-muted-foreground">订单 {o.id}</p>
      <MarketImage src={o.image} name={`单件订单 ${o.id}`}/>
      <p>磨损 {o.paintwear??'未知'} · 模板 {o.paintseed??'未知'} · 涂装 {o.paintindex??'未提供'}<br/>特殊款式须人工核对，不根据图片推断。</p>
      <p className="text-muted-foreground">采集 {time(o.fetched_at)}<br/>源更新时间 {o.source_updated_at||'未提供'}</p>
    </div>)}</div>}
    {!items.length&&!query.isFetching&&<p className="rounded-xl bg-muted p-4 text-xs">{page===1?'暂无已保存明细；到达商品下次可尝试时间后，可手动更新此页。':'此页没有订单，可返回上一页。'}</p>}
    <div className="mt-4 flex gap-3"><Button className="min-h-11" variant="outline" disabled={page===1||query.isFetching} onClick={()=>setPage(p=>p-1)}>上一页</Button><Button className="min-h-11" variant="outline" disabled={query.isFetching||(data?.total!=null&&page*size>=data.total)||page>=2000} onClick={()=>setPage(p=>p+1)}>下一页</Button></div>
  </section>;
}