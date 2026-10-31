export function redact(value) {
  return String(value??'').replace(/Bearer\s+[^\s"'<>]+/gi,'Bearer [已脱敏]').replace(/((?:api[_-]?key|access[_-]?token|authorization|secret)\s*["']?\s*[:=]\s*["']?)[^\s,"'<>}]+/gi,'$1[已脱敏]').replace(/https?:\/\/[^\s"'<>]+/gi,'[URL已脱敏]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[邮箱已脱敏]').replace(/<[^>]*>/g,' ').slice(0,600);
}
export function retryPlan(error,control,now=Date.now()) {
  const raw=error.retryAfter,seconds=raw!=null&&/^\d+(?:\.\d+)?$/.test(String(raw).trim())?Number(raw):null;
  const date=raw!=null&&seconds===null?Date.parse(String(raw)):NaN;
  const supplied=seconds!==null||Number.isFinite(date);
  const streak=(control.rate_limit_streak||0)+1;
  const until=supplied?(seconds!==null?now+seconds*1000:Math.max(now,date)):now+Math.min(900000,60000*2**Math.min(streak-1,4));
  return {retry_at:new Date(until).toISOString(),retry_basis:supplied?'upstream_retry_after':'application_backoff',rate_limit_streak:streak,recovery_pending:true,rate_limit_evidence:{observed_at:new Date(now).toISOString(),http_status:error.httpStatus??null,business_code:error.businessCode??null,business_message:redact(error.businessMessage||error.message),tool:error.tool||null,method:error.method||null,goods_id:error.goodsId||null,retry_after:raw??null,retry_after_source:error.retryAfterSource||null,explicit_limit:true}};
}
export async function writeRequestLog(db,record) {
  console.info('market_request',JSON.stringify(record));
  await db.MarketRequestLog.create(record).catch(error=>console.error('market_request_log_failed',redact(error.message)));
}