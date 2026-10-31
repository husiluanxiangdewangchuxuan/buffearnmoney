import { createContext, useContext } from 'react';
export const PurchaseContext=createContext(null);
export const usePurchase=()=>useContext(PurchaseContext);