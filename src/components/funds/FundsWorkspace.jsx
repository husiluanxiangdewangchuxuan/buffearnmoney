import React, { useState } from 'react';
import FundsCard from '@/components/funds/FundsCard';
import FundsPlans from '@/components/funds/FundsPlans';
import FundsReceipts from '@/components/funds/FundsReceipts';
import FundsHistory from '@/components/funds/FundsHistory';
import PurchaseCandidates from '@/components/funds/PurchaseCandidates';
import { useFunds } from '@/components/funds/fundClient';
export default function FundsWorkspace(){const [limit,setLimit]=useState(20),[paymentPlan,setPaymentPlan]=useState(null),query=useFunds(limit),book=query.data?.book;return <div className="mb-7 space-y-5"><FundsCard/><PurchaseCandidates book={book} onReserved={id=>{setPaymentPlan(id);requestAnimationFrame(()=>document.getElementById('purchase-plans')?.scrollIntoView({block:'start'}));}}/>{book?.initialized&&<><FundsPlans key={paymentPlan||'plans'} book={book} initialPay={paymentPlan}/><FundsReceipts book={book}/><FundsHistory book={book} onMore={()=>setLimit(v=>Math.min(200,v+20))}/></>}</div>;}