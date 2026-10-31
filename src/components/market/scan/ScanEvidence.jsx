import React from 'react';
import { Link } from 'react-router-dom';
import { price, time } from '@/components/market/marketClient';
import { scanOutcome } from '@/components/market/scan/scanClient';
import MarketResearch from '@/components/market/MarketResearch';
import QuoteChart from '@/components/market/QuoteChart';
export default function ScanEvidence({record}) {
  const data=record.payload;
  return <article className="space-y-3 rounded-xl border bg-card p-4 text-xs leading-6"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm font-semibold">{data.item.name}</h3><span className="rounded-full bg-muted px-3 py-1">{scanOutcome[data.outcome]}</span></div><p>#{data.goods_id} · {price(data.item.sell_cents)} · 趋势分 {data.research.score??'未打完整分'}</p><p>证据采集 {time(data.fetched_at)} · 来源 {data.tool} · 当前不会自动更新或覆盖这份轮次证据。</p><p>历史证据不等于当前可成交行情，不作为资金预留或采购指令。</p><details><summary className="cursor-pointer font-medium text-primary">查看本轮留存走势与评分依据</summary><div className="mt-3 space-y-4"><QuoteChart series={data.series}/><MarketResearch data={data}/></div></details><Link className="inline-block text-primary underline" to={`/market/${data.goods_id}?returnTo=${encodeURIComponent('/?tab=scan')}`}>查看当前商品行情（与留存证据分开）</Link></article>;
}