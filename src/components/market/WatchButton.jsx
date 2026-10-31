import React, { useContext } from 'react';
import { WatchContext } from '@/components/market/WatchScope';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useStockUser } from '@/components/stock/useStockData';
import { marketError } from '@/components/market/marketClient';
import { watchSnapshot } from '@/components/market/watchQuote';
export default function WatchButton({goodsId,name,record,data}) {
  const {data:user}=useStockUser(),client=useQueryClient(),scope=useContext(WatchContext);
  const single=useQuery({queryKey:['market-watch',user?.id,goodsId],enabled:!!user&&!!goodsId&&!scope&&!record,queryFn:()=>base44.entities.MarketWatch.filter({owner_id:user.id,goods_id:String(goodsId)},{limit:1}),staleTime:60000});
  const query=scope||single,existing=record||query.data?.items?.find(r=>r.goods_id===String(goodsId));
  const mutation=useMutation({mutationFn:async()=>{if(existing)return base44.entities.MarketWatch.delete(existing.id);const check=await base44.entities.MarketWatch.filter({owner_id:user.id,goods_id:String(goodsId)},{limit:1});if(check.items.length)return;return base44.entities.MarketWatch.create({owner_id:user.id,goods_id:String(goodsId),name,variant_scope:'商品级',monitoring:true,watched_at:new Date().toISOString(),...watchSnapshot(data)});},onSuccess:()=>client.invalidateQueries({queryKey:['market-watch']})});
  return <div><Button variant="outline" className="min-h-11 w-full" disabled={!user||(!record&&query.isPending)||mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?'正在保存…':existing?'取消自选':'加入自选'}</Button>{(mutation.error||query.error)&&<p role="alert" className="mt-1 text-xs text-destructive">{marketError(mutation.error||query.error)}</p>}</div>;
}