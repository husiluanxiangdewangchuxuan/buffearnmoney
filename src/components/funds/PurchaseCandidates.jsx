import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import usePurchaseCandidates from '@/components/funds/usePurchaseCandidates';
import PurchaseCandidateItem from '@/components/funds/PurchaseCandidateItem';
import { fundError } from '@/components/funds/fundClient';
export default function PurchaseCandidates({book,onReserved}) {
  const candidates=usePurchaseCandidates(),{query}=candidates;
  return <section className="space-y-4 rounded-2xl border bg-card p-5"><h2 className="font-semibold">进货候选 · 是否进货</h2><p className="text-xs leading-6 text-muted-foreground">行情页加入的候选会保存在这里。逐款选择进货并填写实际付款；选择时只预留预算，确认实际付款后按金额扣减平台或银行卡余额，不会重复扣款，也不会代为下单。参考报价可能已过期，付款前请核对真实成交金额。</p>{query.isPending&&<p role="status" className="text-sm">正在读取进货候选…</p>}{candidates.error&&<p role="alert" className="text-sm text-destructive">{fundError(candidates.error)}</p>}{!book?.initialized&&<p className="text-sm text-muted-foreground">请先在上方启用资金池，填写当前余额后即可确认进货。</p>}{candidates.items.map(item=><PurchaseCandidateItem key={item.id} item={item} book={book} onRemove={candidates.remove} onReserved={onReserved}/>)}{!query.isPending&&!query.error&&!candidates.items.length&&<p className="text-sm">暂无待选择的进货候选。<Link to="/?tab=market" className="text-primary underline">去市场选品加入</Link></p>}{query.hasNextPage&&<Button variant="outline" className="min-h-11" disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>{query.isFetchingNextPage?'读取中…':'加载更多候选'}</Button>}</section>;
}