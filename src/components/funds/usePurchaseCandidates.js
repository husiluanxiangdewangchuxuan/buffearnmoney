import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useStockUser } from '@/components/stock/useStockData';
export default function usePurchaseCandidates() {
  const {data:user}=useStockUser(),client=useQueryClient(),key=['purchase-candidates',user?.id];
  const query=useInfiniteQuery({queryKey:key,enabled:!!user,initialPageParam:undefined,queryFn:({pageParam})=>base44.entities.PurchaseCandidate.filter({owner_id:user.id},{limit:50,sort:'-created_date',cursor:pageParam}),getNextPageParam:page=>page.has_more?page.next_cursor:undefined});
  const items=query.data?.pages.flatMap(page=>page.items)||[];
  const mutation=useMutation({mutationFn:async({action,data,id,quantity})=>{
    if(!user)throw new Error('请先登录');
    if(action==='toggle'){
      const existing=await base44.entities.PurchaseCandidate.filter({owner_id:user.id,goods_id:String(data.goods_id)},{limit:1});
      if(existing.items.length)return base44.entities.PurchaseCandidate.delete(existing.items[0].id);
      if(data.stale||!Number.isFinite(Date.parse(data.fetched_at))||Date.now()-Date.parse(data.fetched_at)>3600000||!Number.isSafeInteger(data.item.sell_cents)||data.item.sell_cents<=0)throw new Error('报价已过期或无效，请刷新行情后重新选择');
      return base44.entities.PurchaseCandidate.create({owner_id:user.id,goods_id:String(data.goods_id),name:data.item.name,unit_cents:data.item.sell_cents,quantity:1,quote_at:data.fetched_at});
    }
    if(action==='clear')return base44.entities.PurchaseCandidate.deleteMany({owner_id:user.id,id:{$in:items.map(item=>item.id)}});
    const item=items.find(item=>item.id===id||item.goods_id===id);
    if(!item)throw new Error('候选已更新，请刷新清单');
    if(action==='remove')return base44.entities.PurchaseCandidate.delete(item.id);
    if(!Number.isInteger(quantity)||quantity<1||quantity>999)throw new Error('数量应为1至999的整数');
    return base44.entities.PurchaseCandidate.update(item.id,{quantity});
  },onSettled:()=>client.invalidateQueries({queryKey:key})});
  return {items,query,pending:mutation.isPending,error:mutation.error||query.error,toggle:data=>mutation.mutate({action:'toggle',data}),update:(id,quantity)=>mutation.mutate({action:'update',id,quantity}),remove:id=>mutation.mutateAsync({action:'remove',id}),clear:()=>mutation.mutateAsync({action:'clear'})};
}