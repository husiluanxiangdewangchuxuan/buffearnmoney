import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import BalanceForm from '@/components/funds/BalanceForm';
import TransferForm from '@/components/funds/TransferForm';
import ReceiptForm from '@/components/funds/ReceiptForm';
export default function ManageFunds({book,onClose}) {
 const [tab,setTab]=useState('balances');
 return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>管理资金</DialogTitle><DialogDescription>只统计可花的钱，库存估值与待结算回款不充当现金。</DialogDescription></DialogHeader>{book?.initialized&&<div className="grid grid-cols-3 gap-2">{[['balances','余额调整'],['transfer','充值登记'],['receipt','销售回款']].map(([key,label])=><Button key={key} variant={tab===key?'default':'outline'} className="min-h-11 px-2" onClick={()=>setTab(key)}>{label}</Button>)}</div>}{tab==='balances'?<BalanceForm key={book?.version??0} book={book} onSaved={onClose}/>:tab==='transfer'?<TransferForm book={book} onSaved={onClose}/>:<ReceiptForm book={book} onSaved={onClose}/>}</DialogContent></Dialog>;
}