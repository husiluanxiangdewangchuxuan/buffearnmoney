import React from 'react';
import usePurchaseCandidates from '@/components/funds/usePurchaseCandidates';
import { PurchaseContext } from '@/components/funds/purchaseContext';
import PurchaseBasket from '@/components/funds/PurchaseBasket';
export default function PurchaseScope({children,showBasket=true}) {
 const candidates=usePurchaseCandidates();
 return <PurchaseContext.Provider value={candidates}>{showBasket&&<PurchaseBasket/>}{children}</PurchaseContext.Provider>;
}