import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { time } from '@/components/market/marketClient';
export default function MarketNotice({loading,error,data,catalog=false}) {
  const issues=[...(data?.refresh_errors||[]),...(data?.errors||[])].filter(issue=>issue.code!=='UPSTREAM_COOLDOWN'||Date.parse(data?.settings?.retry_at)>Date.now());
  return <>{loading&&<div role="status" className="flex items-center gap-2 rounded-xl border bg-card p-4 text-sm"><Loader2 className="animate-spin" size={18}/>{catalog?'正在读取已保存目录，不请求BUFF…':'正在读取已保存行情，不请求BUFF…'}</div>}{error&&<div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertCircle className="mb-2" size={18}/>上次请求未完成：{error}。已有成功数据不会被清零，可稍后点击刷新。</div>}{(data?.stale||issues.length>0)&&<div className="rounded-xl border bg-muted p-4 text-xs leading-6">{data?.stale?`正在显示历史行情，上次成功采集 ${time(data.fetched_at)}；本次未取得新数据，请勿当作当前报价采购。 `:''}{issues.map(e=>e.message).filter((v,i,a)=>a.indexOf(v)===i).join('；')}</div>}</>;
}