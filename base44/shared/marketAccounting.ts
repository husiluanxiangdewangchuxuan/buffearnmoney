export const chinaDay=(now=Date.now())=>new Date(now+28800000).toISOString().slice(0,10);
export const knownTools=['buff_get_market_goods','buff_get_sell_order','buff_get_buy_order','buff_get_price_history'];
export async function ensureAccounting(db,control){
  if(control.accounting_version||control.lease_until>new Date().toISOString())return control;
  await db.MarketControl.updateMany({id:control.id,accounting_version:{$exists:false},day:control.day,calls:control.calls,lease_token:control.lease_token,lease_until:control.lease_until},{$set:{accounting_version:'mcp-tools-v1',accounting_started_at:new Date().toISOString(),legacy_day:control.day||'',legacy_budget_calls:control.calls||0,calls:0,tool_counts:{},protocol_counts:{},upstream_info:{}}});
  return db.MarketControl.get(control.id);
}
export function createUsage(control){
  const days=new Map(),upstream={...(control.upstream_info||{})},events=[];
  function totals(day){if(!days.has(day))days.set(day,{tool_counts:{},protocol_counts:{}});return days.get(day);}
  function snapshot(day=chinaDay()){
    const same=control.day===day,baseTools=same?control.tool_counts||{}:{},baseProtocol=same?control.protocol_counts||{}:{},local=totals(day);
    const add=(a,b)=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(key=>[key,(a[key]||0)+(b[key]||0)]));
    const tool_counts=add(baseTools,local.tool_counts),protocol_counts=add(baseProtocol,local.protocol_counts);
    return {day,calls:(same?control.calls||0:0)+Object.values(local.tool_counts).reduce((a,b)=>a+b,0),tool_counts,protocol_counts,upstream_info:upstream};
  }
  return {
    snapshot,
    evidence(){return events.slice(0,32);},
    beforeTool(){const s=snapshot(),legacy=control.legacy_day===s.day?control.legacy_budget_calls||0:0;if(s.calls+legacy>=control.daily_limit)throw Object.assign(new Error('本应用每日采集预算不足，仅暂停实时采集，历史详情仍可查看；管理员可在设置中调整预算'),{status:429,code:'APP_DAILY_BUDGET'});},
    sent({method,tool,at,...context}){events.push({method,tool:tool||null,at:new Date(at).toISOString(),...context,sent:true,http_status:null});const row=totals(chinaDay(at)),kind=method==='tools/call'?'tool_counts':'protocol_counts',name=method==='tools/call'?tool:method;row[kind][name]=(row[kind][name]||0)+1;const key=method==='tools/call'?tool:`rpc:${method}`;upstream[key]={observed_at:new Date(at).toISOString(),remaining:null,limit:null,reset:null,retry_after:null,http_status:null,limited:false,quota_fields:{}};},
    observe({method,tool,request_id,...info}){const event=request_id?events.find(e=>e.request_id===request_id):[...events].reverse().find(e=>e.method===method&&e.tool===(tool||null));if(event)Object.assign(event,info);const key=method==='tools/call'?tool:`rpc:${method}`,old=upstream[key]||{};upstream[key]={...old,...info,quota_fields:{...old.quota_fields,...info.quota_fields}};},
    request(){const tools={},protocol={};for(const row of days.values()){for(const [key,value] of Object.entries(row.tool_counts))tools[key]=(tools[key]||0)+value;for(const [key,value] of Object.entries(row.protocol_counts))protocol[key]=(protocol[key]||0)+value;}return {tool_calls:Object.values(tools).reduce((a,b)=>a+b,0),protocol_calls:Object.values(protocol).reduce((a,b)=>a+b,0),tool_counts:tools,protocol_counts:protocol};}
  };
}
export function usageSettings(control,tracker=null){
  const today=chinaDay(),s=tracker?tracker.snapshot(today):{day:today,calls:control.day===today?control.calls||0:0,tool_counts:control.day===today?control.tool_counts||{}:{},protocol_counts:control.day===today?control.protocol_counts||{}:{},upstream_info:control.upstream_info||{}};
  const ready=!!control.accounting_version,legacy=ready?(control.legacy_day===today?control.legacy_budget_calls||0:0):(control.day===today?control.calls||0:0),actual=ready?s.calls:null,used=ready?s.calls+legacy:legacy;
  return {daily_limit:control.daily_limit,used_calls:used,actual_tool_calls:actual,protocol_calls:ready?Object.values(s.protocol_counts).reduce((a,b)=>a+b,0):null,remaining_budget:Math.max(0,control.daily_limit-used),legacy_budget_calls:legacy,accounting_started_at:control.accounting_started_at||null,full_day_accounting:ready&&chinaDay(Date.parse(control.accounting_started_at))<today,day:today,tools:knownTools.map(name=>({name,calls:ready?s.tool_counts[name]||0:null,upstream:s.upstream_info[name]||null})),protocol_counts:s.protocol_counts,protocol_upstream:Object.fromEntries(Object.entries(s.upstream_info).filter(([key])=>key.startsWith('rpc:'))),cache_minutes:60,refresh_cooldown_seconds:3600,concurrency:1,schedule:'仅App前台在线时，每60分钟错峰更新基础报价；库存优先，其次自选、采购候选；同款全应用共享，无人使用不采集',upstream_quota:'仅按真实回包逐工具展示，未提供为未知',last_success:control.last_success||null,last_error:control.last_error||null,last_error_code:control.last_error_code||null,lease_until:control.lease_until||null,retry_at:control.retry_at&&Date.parse(control.retry_at)>Date.now()?control.retry_at:null,retry_basis:control.retry_basis||null,recovery_pending:!!control.recovery_pending||!!control.retry_at,last_limit_evidence:control.rate_limit_evidence||null,running:control.lease_until>new Date().toISOString(),accounting_ready:ready};
}