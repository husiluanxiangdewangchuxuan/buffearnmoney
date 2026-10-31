import React from 'react';
import { Button } from '@/components/ui/button';
export default function ScanControls({state,admin,busy,onAction}) {
  if(!admin)return <p className="text-xs leading-6 text-muted-foreground">可查看扫描进度与留存证据；启动、暂停和续扫仅由管理员操作。</p>;
  const active=state&&['running','paused'].includes(state.status);
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">
    {!active&&<Button className="min-h-11" disabled={busy} onClick={()=>onAction('start')}>新建扫描轮次</Button>}
    {state?.status==='running'&&<><Button className="min-h-11" disabled={busy} onClick={()=>onAction('step')}>{busy?'正在处理…':'执行本批（最多3款）'}</Button><Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>onAction('pause')}>暂停扫描</Button></>}
    {state?.status==='paused'&&<Button className="min-h-11" disabled={busy} onClick={()=>onAction('resume')}>恢复断点</Button>}
    {active&&<Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>{if(window.confirm('结束后不能续扫本轮，已留存的证据不会删除；确认结束？'))onAction('finish');}}>结束本轮</Button>}
  </div><p className="text-xs leading-6 text-muted-foreground">每批最多读取一页目录、研究3款；不自动连续执行，遵守管理员配置的本应用每日采集预算。限流、额度不足或失败保留断点，再次执行不会重写已有商品证据。</p></div>;
}