import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import MoneyField from '@/components/funds/MoneyField';
import { amount, fundError, useFundMutation } from '@/components/funds/fundClient';
export default function TransferForm({book,onSaved}) {
 const [value,setValue]=useState(''),[operation]=useState(()=>crypto.randomUUID()),mutation=useFundMutation(book);
 async function submit(e){e.preventDefault();try{await mutation.mutateAsync({action:'transfer',operation_id:operation,amount_cents:amount(value)});onSaved();}catch{}}
 return <form onSubmit={submit} className="space-y-4"><p className="text-xs leading-6 text-muted-foreground">请先在平台完成充值，再登记实际金额。这里只记账，不会转账；银行卡减少、平台增加，总额不变，不计入收入或利润。</p><MoneyField label="银行卡充值到平台" value={value} onChange={setValue}/>{mutation.error&&<p role="alert" className="text-sm text-destructive">{fundError(mutation.error)}</p>}<Button className="min-h-11 w-full" disabled={mutation.isPending}>{mutation.isPending?'保存中…':'确认充值已完成'}</Button></form>;
}