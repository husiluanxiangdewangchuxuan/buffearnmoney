import { useInfiniteQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useStockUser } from '@/components/stock/useStockData';
import { marketCall } from '@/components/market/marketClient';
export default function useWatchlist() {
  const {data:user}=useStockUser();
  return useInfiniteQuery({queryKey:['market-watch',user?.id,'quotes'],enabled:!!user,initialPageParam:undefined,staleTime:60000,refetchOnWindowFocus:false,queryFn:async({pageParam})=>{
    const page=await base44.entities.MarketWatch.filter({owner_id:user.id},{limit:20,sort:'-created_date',cursor:pageParam});
    const ids=[...new Set(page.items.map(row=>row.goods_id))];
    const cached=ids.length?await marketCall({action:'read_batch',goods_ids:ids}):{items:[]};
    const byId=new Map(cached.items.map(data=>[data.goods_id,data]));
    return {...page,items:page.items.map(watch=>({watch,quote:byId.get(watch.goods_id)||null}))};
  },getNextPageParam:page=>page.has_more?page.next_cursor:undefined});
}