import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import MarketBrowser from '@/components/market/MarketBrowser';
import MarketHistory from '@/components/market/MarketHistory';
export default function MarketHistoryAccess({refreshKey}){
  const [params,setParams]=useSearchParams(),history=params.get('view')!=='catalog';
  const select=mode=>{const next=new URLSearchParams(params);next.set('view',mode);setParams(next);};
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-2"><Button className="min-h-11" variant={history?'default':'outline'} onClick={()=>select('history')}>已保存历史</Button><Button className="min-h-11" variant={!history?'default':'outline'} onClick={()=>select('catalog')}>当前目录</Button></div>{history?<MarketHistory/>:<MarketBrowser refreshKey={refreshKey}/>}</div>;
}