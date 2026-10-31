import React, { useState } from 'react';
import { Image } from '@/components/ui/image';
import { ImageOff } from 'lucide-react';
export default function MarketImage({src,name,compact=false}) {
  const [failed,setFailed]=useState(false);
  return <div className={compact?'flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border bg-muted/30':'flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border bg-muted/30'}>{src&&!failed?<Image src={src} alt={name} fittingType="fit" className="h-full w-full" onError={()=>setFailed(true)}/>:<span className="flex flex-col items-center gap-2 text-xs text-muted-foreground"><ImageOff size={22}/>暂无商品图</span>}</div>;
}