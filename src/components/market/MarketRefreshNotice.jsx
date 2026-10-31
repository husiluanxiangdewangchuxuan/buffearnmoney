import React from 'react';
import { time } from '@/components/market/marketClient';
export default function MarketRefreshNotice({state}) {
  const data=state?.settings;
  if(!data)return null;
  const reason=data.last_limit_evidence?.explicit_limit?'BUFF明确限流后的共享冷却尚未解除':'上次冷却尚未解除，原始原因待核实';
  const label=data.retry_basis==='upstream_retry_after'?'Retry-After 等待截止':data.retry_basis==='application_backoff'?'下次可尝试时间（应用退避，非上游承诺）':'下次可尝试时间（来源待核实）';
  return <div className="rounded-lg border bg-muted/40 px-3 py-3 text-xs leading-6" role="status"><p>本应用今日预算：已用 {data.used_calls} / {data.daily_limit}，剩余 {data.remaining_budget}，本次所需 {state.requiredCalls} 次工具调用（非 BUFF 官方配额）。</p>{state.waiting&&<><p className="font-medium">{reason}，重复刷新已禁用，不会请求 BUFF。</p><p>{label}：{time(data.retry_at)}（北京时间）。到时仅允许一次基础报价探测，不自动重试。</p></>}{!state.waiting&&data.recovery_pending&&<p>等待已到期；下次操作仅查一次基础报价，成功后才可继续加载详情。</p>}{state.budgetBlocked&&<p className="text-destructive">本应用每日预算不足，并非 BUFF 已确认限流；本次不会发出上游请求。</p>}</div>;
}