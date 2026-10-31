import React from 'react';
import FundsCard from '@/components/funds/FundsCard';
import { useStockSummary } from '@/components/stock/useStockData';
import { price } from '@/components/market/marketClient';
export default function MarketFunds() {
  const {data,isPending,isError}=useStockSummary();
  const protectedUnits=data?.states?.find(x=>x.trade_status==='protected')?.sum_quantity??0;
  return <div className="space-y-3"><FundsCard compact/><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">已知库存占款</p><strong className="mt-2 block break-all text-sm">{isPending?'读取中':isError?'读取失败':price(data?.total?.sum_cost_total_cents??0)}</strong><p className="mt-1 text-[10px] text-muted-foreground">未知成本未计入</p></div><div className="rounded-xl border bg-card p-4"><p className="text-xs text-muted-foreground">交易保护中</p><strong className="mt-2 block text-sm">{isPending?'读取中':isError?'读取失败':`${protectedUnits} 件`}</strong><p className="mt-1 text-[10px] text-muted-foreground">以人工记录状态为准</p></div></div></div>;
}