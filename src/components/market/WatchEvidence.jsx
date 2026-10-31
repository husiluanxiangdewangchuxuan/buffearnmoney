import React from 'react';
import BuyConditionTags from '@/components/market/BuyConditionTags';
import CandidateToggle from '@/components/funds/CandidateToggle';
import { price } from '@/components/market/marketClient';
import { validPrice } from '@/components/market/watchQuote';
export default function WatchEvidence({quote}) {
  const limited=(quote?.buy?.items||[]).filter(order=>validPrice(order.price_cents)&&order.remaining>0&&Array.isArray(order.conditions)&&order.conditions.length);
  return <details className="mt-2 text-xs"><summary className="min-h-11 cursor-pointer py-3 text-muted-foreground">限定求购与进货候选{limited.length?' · 有限定条件':''}</summary><div className="space-y-3 pb-2">{limited.length>0&&<div className="space-y-2 rounded-lg bg-market-warning p-3 text-market-warning-foreground"><p className="font-medium">限定求购，仅适用于满足条件的单件</p>{limited.map(order=><div key={order.id} className="flex flex-wrap items-center gap-2"><strong>{price(order.price_cents)}</strong><BuyConditionTags conditions={order.conditions}/></div>)}</div>}<p className="leading-5 text-muted-foreground">{quote?.research?.reasons?.[0]?`观察依据：${quote.research.reasons[0]}`:'尚无有效历史研究依据，打开详情可按需加载。'} 商品报价差不等于利润，不自动交易。</p>{quote?<CandidateToggle data={quote}/>:<p className="text-muted-foreground">请先更新有效报价，再选择进货候选。</p>}</div></details>;
}