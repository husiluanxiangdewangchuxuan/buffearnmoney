import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cash, stamp, fundError, useFundMutation } from '@/components/funds/fundClient';
export default function PurchaseCandidateItem({item,book,onRemove,onReserved}) {
  const [quantity,setQuantity]=useState(item.quantity),[error,setError]=useState(''),[busy,setBusy]=useState(false),mutation=useFundMutation(book);
  const total=quantity*item.unit_cents,valid=Number.isInteger(quantity)&&quantity>=1&&quantity<=999;
  const existing=book?.plans?.find(plan=>plan.id===`candidate-${item.id}`);
  async function choose(){
    setError('');setBusy(true);
    try{
      const result=await mutation.mutateAsync({action:'reserve',operation_id:`candidate-${item.id}`,name:`进货：${item.name}`.slice(0,80),items:[{goods_id:item.goods_id,name:item.name,quantity,unit_cents:item.unit_cents,quote_at:item.quote_at}]});
      onReserved(result.book.plans.find(plan=>plan.id===`candidate-${item.id}`)?.id);
      await onRemove(item.id);
    }catch(e){setError(fundError(e));}finally{setBusy(false);}
  }
  async function remove(){setError('');setBusy(true);try{await onRemove(item.id);}catch(e){setError(fundError(e));}finally{setBusy(false);}}
  return <article className="space-y-3 rounded-xl border p-4"><Link className="break-words text-sm font-medium text-primary underline" to={`/market/${item.goods_id}`}>{item.name} · #{item.goods_id}</Link><p className="text-xs text-muted-foreground">参考单价 {cash(item.unit_cents)} · 报价时间 {stamp(item.quote_at)}</p><div className="flex flex-wrap items-end gap-3"><label className="space-y-2 text-xs">进货数量<Input aria-label={`${item.name}进货数量`} type="number" min="1" max="999" step="1" className="min-h-11 w-24" value={quantity} disabled={busy||!!existing} onChange={e=>setQuantity(Number(e.target.value))}/></label><p className="pb-3 text-sm">预计 {valid?cash(total):'请修正数量'}</p></div>{existing?<><p className="text-xs text-muted-foreground">已转为进货计划，不会重复预留或扣款。请在下方计划中继续登记付款或核对状态。</p><Button variant="outline" disabled={busy} className="min-h-11" onClick={remove}>移出候选清单</Button></>:<div className="flex flex-wrap gap-2"><Button className="min-h-11" disabled={busy||!book?.initialized||!valid||total>book.available_cents} onClick={choose}>{busy?'处理中…':'选择进货，填写付款'}</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={remove}>暂不进货，移除</Button></div>}{book?.initialized&&valid&&total>book.available_cents&&!existing&&<p className="text-xs text-destructive">超出可用预算 {cash(total-book.available_cents)}，请调整数量或资金。</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</article>;
}