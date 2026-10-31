import React, { createContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useStockUser } from '@/components/stock/useStockData';
export const WatchContext=createContext(null);
export default function WatchScope({ids,children}) {
  const {data:user}=useStockUser();
  const query=useQuery({queryKey:['market-watch',user?.id,'scope',ids.join(',')],enabled:!!user&&ids.length>0,queryFn:()=>base44.entities.MarketWatch.filter({owner_id:user.id,goods_id:{$in:ids}},{limit:100}),staleTime:60000});
  return <WatchContext.Provider value={query}>{children}</WatchContext.Provider>;
}