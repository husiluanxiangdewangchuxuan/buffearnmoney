import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { openBuff } from '../../shared/buffMcp.ts';
import { groups,gunGroups,readCache,saveCache } from '../../shared/marketService.ts';
import { getBasicQuote,quoteCache } from '../../shared/marketQuote.ts';
import { orders, history } from '../../shared/marketNormalize.ts';
import { readSavedMarket, readSavedMarkets, combineSaved, startMarketRound, finishMarketRound, marketInterval } from '../../shared/savedMarket.ts';
import { ensureAccounting,createUsage,usageSettings } from '../../shared/marketAccounting.ts';
import { redact,retryPlan,writeRequestLog } from '../../shared/marketEvidence.ts';
export default async function(req) {
  let db,control,token,tracker,fallback=null,action,body={},requiredCalls=0,patch={},decision='unknown',failure='',failureCode='',quoteResult=null,logEnabled=false,round=null;
  const started=Date.now(),requestId=crypto.randomUUID();
  const noCalls=()=>({tool_calls:0,protocol_calls:0,tool_counts:{},protocol_counts:{}});
  const usage=()=>tracker?.request()||noCalls();
  const settings=()=>control?{...usageSettings({...control,...patch},tracker),required_calls:requiredCalls}:null;
  let present=payload=>payload;
  const blocked=(message,code,status)=>{
    decision=code;failure=message;failureCode=code;
    const common={error_code:code,refresh_error_code:code,settings:settings(),request_usage:usage(),required_calls:requiredCalls,request_id:requestId,quote_updated_this_request:false};
    if(fallback)return Response.json({...present(fallback),...common,cached:true,stale:Date.now()-Date.parse(fallback.quote_fetched_at||fallback.fetched_at)>=marketInterval,refresh_errors:[{code,message}]});
    return Response.json({error:message,...common},{status});
  };
  try {
    const client=createClientFromRequest(req),user=await client.auth.me().catch(error=>error.status===401?null:Promise.reject(error));
    if(!user)return Response.json({error:'请先登录'},{status:401});
    body=await req.json().catch(()=>({}));action=body.action||'catalog';
    if(!['catalog','quote','detail','history','orders','read_batch','status','inventory','usage','configure'].includes(action))return Response.json({error:'不支持的行情操作'},{status:400});
    if(['usage','configure'].includes(action)&&user.role!=='admin')return Response.json({error:'仅管理员可查看完整用量或调整采集预算'},{status:403});
    if(action==='configure'&&(!Number.isSafeInteger(body.daily_limit)||body.daily_limit<0))return Response.json({error:'每日采集预算必须为非负安全整数'},{status:400});
    if(body.budget_cents!=null&&(!Number.isSafeInteger(body.budget_cents)||body.budget_cents<0))return Response.json({error:'进货预算不正确'},{status:400});
    const group=body.group||'knife',gunGroup=body.gun_group||'rifle',page=body.page??1,search=String(body.search||'').trim(),id=String(body.goods_id||'');
    if(!gunGroups.includes(gunGroup)||!groups[group]||!Number.isInteger(page)||page<1||page>2000||search.length>80||(['quote','detail','history','orders'].includes(action)&&!/^\d{1,12}$/.test(id))||(action==='orders'&&!['sell','buy'].includes(body.kind)))return Response.json({error:'查询条件不正确'},{status:400});
    if(action==='history'&&![7,30].includes(body.days))return Response.json({error:'走势窗口仅支持7天或30天'},{status:400});
    db=client.asServiceRole.entities;
    const inventoryIds=action==='inventory'?body.goods_ids:null;
    if(action==='inventory') {
      if(!Array.isArray(inventoryIds)||!inventoryIds.length||inventoryIds.length>5||inventoryIds.some(value=>typeof value!=='string'||!/^\d{1,12}$/.test(value))||new Set(inventoryIds).size!==inventoryIds.length)return Response.json({error:'一次只能刷新1至5个库存商品ID'},{status:400});
      const own=await db.StockItem.aggregate({query:{owner_id:user.id,goods_id:{$in:inventoryIds}},groupBy:'goods_id'});
      if(inventoryIds.some(goods=>!own.rows.some(row=>row.goods_id===goods)))return Response.json({error:'只能刷新当前账号的库存商品'},{status:403});
    }
    logEnabled=!['status','usage','configure'].includes(action);
    control=(await db.MarketControl.filter({key:'market_m1'},{limit:1})).items[0];
    if(!control)return Response.json({error:'行情试运行配置未初始化'},{status:503});
    control=await ensureAccounting(db,control);
    if(action==='configure'){control=await db.MarketControl.update(control.id,{daily_limit:body.daily_limit});return Response.json(usageSettings(control));}
    if(action==='status'||action==='usage')return Response.json(usageSettings(control));
    if(action==='read_batch'){
      const ids=body.goods_ids;
      if(!Array.isArray(ids)||ids.length>50||ids.some(value=>typeof value!=='string'||!/^\d{1,12}$/.test(value)))return Response.json({error:'只读批量查询最多50个商品ID'},{status:400});
      const items=await readSavedMarkets(db,ids);
      decision='READ_SAVED';return Response.json({items,request_usage:noCalls()});
    }
    if(action==='inventory'){
      const items=[];
      for(const goods of inventoryIds){if(body.refresh===true){const result=await client.functions.invoke('marketData',{action:'quote',goods_id:goods,refresh:true,source:body.source||'manual_inventory'}).catch(error=>({data:error.response?.data||{error:error.message}}));items.push(result.data);if(result.data.error||result.data.refresh_errors?.length)break;}else items.push(await readSavedMarket(db,goods));}
      const combined=noCalls();for(const item of items){const child=item.request_usage;if(!child)continue;combined.tool_calls+=child.tool_calls;combined.protocol_calls+=child.protocol_calls;for(const [name,count] of Object.entries(child.tool_counts||{}))combined.tool_counts[name]=(combined.tool_counts[name]||0)+count;for(const [name,count] of Object.entries(child.protocol_counts||{}))combined.protocol_counts[name]=(combined.protocol_counts[name]||0)+count;}
      decision='INVENTORY_SHARED_ROUNDS';return Response.json({items,settings:settings(),request_usage:combined,child_request_ids:items.map(item=>item.request_id).filter(Boolean)});
    }
    if(action==='catalog'){
      const key=`catalog:${group}:${group==='gun'?gunGroup:'all'}:${page}:${search}`,saved=await readCache(db,key);
      let payload=saved?.payload||{items:[],returned:0,page,total:0,group,search,fetched_at:null,scope:'仅显示已保存目录，不自动采集'};
      const keys=payload.items.flatMap(row=>[`quote:${row.goods_id}`,`detail:${row.goods_id}`,`round:${row.goods_id}`,`history:${row.goods_id}:7`,`history:${row.goods_id}:30`]);
      const rows=keys.length?(await db.MarketCache.filter({cache_key:{$in:keys}},{sort:'-fetched_at',limit:100})).items:[];
      payload.items=payload.items.map(row=>{const saved=combineSaved(row.goods_id,rows);return saved.empty?{...row,next_allowed_at:row.fetched_at?new Date(Date.parse(row.fetched_at)+marketInterval).toISOString():null}:{...row,...saved,item:{...row.item,...saved.item,name:saved.item.name===`商品 #${row.goods_id}`?row.item.name:saved.item.name}};});
      if(body.budget_cents!=null)payload={...payload,items:payload.items.filter(row=>row.item?.sell_cents>0&&row.item.sell_cents<=body.budget_cents),unfiltered_returned:payload.items.length};
      payload.returned=payload.items.length;decision='READ_SAVED';return Response.json({...payload,cached:true,settings:settings(),request_usage:noCalls()});
    }
    fallback=await readSavedMarket(db,id);
    if(body.refresh!==true){decision='READ_SAVED';quoteResult=fallback;const payload=action==='orders'?((await readCache(db,`orders:${id}:${body.kind}:${page}`))?.payload||(page===1?fallback[body.kind]:null)||{items:[],page,total:null,fetched_at:null}):fallback;return Response.json({...payload,settings:settings(),request_usage:noCalls(),request_id:requestId});}
    if(action==='detail')action='quote';
    const reuse=()=>{quoteResult=fallback;return Response.json({...fallback,cached:true,decision:fallback.round_status==='running'?'ROUND_IN_FLIGHT':'ROUND_REUSED',message:'同一商品共用一轮，60分钟内不重复启动',settings:settings(),request_usage:noCalls(),request_id:requestId});};
    if(Date.parse(fallback.next_allowed_at)>Date.now()){decision=fallback.round_status==='running'?'ROUND_IN_FLIGHT':'ROUND_REUSED';return reuse();}
    const key=`orders:${id}:${body.kind}:${page}`;
    requiredCalls=1;
    let recovering=!!control.recovery_pending||!!control.retry_at;
    let probeId=id;
    const cooldown=()=>control.retry_at&&Date.parse(control.retry_at)>Date.now();
    const waitMessage=()=>`${control.rate_limit_evidence?.explicit_limit?'上次BUFF明确限流的冷却尚未解除':'上次冷却尚未解除，原始原因待核实'}；${control.retry_basis==='upstream_retry_after'?'上游 Retry-After 截止':'应用下次尝试时间'}：${new Date(control.retry_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}（北京时间）；本次未请求BUFF`;
    if(cooldown())return blocked(waitMessage(),'UPSTREAM_COOLDOWN',409);
    if(control.lease_until>new Date().toISOString()||!control.accounting_version)return blocked('另一项行情采集正在运行，本次未请求BUFF','COLLECTION_BUSY',409);
    if(recovering&&!/^\d{1,12}$/.test(String(probeId||'')))return blocked('冷却已到期，请先更新任一商品的基础报价完成一次恢复探测，再加载目录或详情','RECOVERY_PROBE_REQUIRED',409);
    if(settings().remaining_budget<requiredCalls)return blocked(`本应用每日预算不足：今日已用 ${settings().used_calls}，剩余 ${settings().remaining_budget}，本次所需 ${requiredCalls} 次工具调用；本次未请求BUFF`,'APP_DAILY_BUDGET',429);
    const candidate=crypto.randomUUID();
    await db.MarketControl.updateMany({id:control.id,lease_token:control.lease_token,lease_until:control.lease_until,retry_at:control.retry_at},{$set:{lease_token:candidate,lease_until:new Date(Date.now()+290000).toISOString()}});
    const acquired=await db.MarketControl.get(control.id);
    if(acquired.lease_token!==candidate){fallback=await readSavedMarket(db,id);if(Date.parse(fallback.next_allowed_at)>Date.now()){decision='ROUND_IN_FLIGHT';return reuse();}return blocked('其他窗口已启动采集，本次未请求BUFF','COLLECTION_BUSY',409);}
    token=candidate;control=acquired;
    if(cooldown())return blocked(waitMessage(),'UPSTREAM_COOLDOWN',409);
    recovering=!!control.recovery_pending||!!control.retry_at;
    probeId=id||inventoryIds?.[0]||control.rate_limit_evidence?.goods_id;
    requiredCalls=1;
    fallback=await readSavedMarket(db,id);
    if(Date.parse(fallback.next_allowed_at)>Date.now()){decision='ROUND_REUSED';return reuse();}
    if(settings().remaining_budget<requiredCalls)return blocked(`本应用每日预算不足：今日已用 ${settings().used_calls}，剩余 ${settings().remaining_budget}，本次所需 ${requiredCalls} 次；未请求BUFF`,'APP_DAILY_BUDGET',429);
    if(recovering&&!/^\d{1,12}$/.test(String(probeId||'')))return blocked('请先更新一个商品的基础报价完成恢复探测','RECOVERY_PROBE_REQUIRED',409);
    if(recovering){patch={retry_at:'',recovery_pending:true};await db.MarketControl.updateMany({id:control.id,lease_token:token},{$set:patch});control={...control,...patch};}
    round=await startMarketRound(db,id,action,body.source||'unknown');
    tracker=createUsage(control);
    const mcp=await openBuff(event=>tracker.sent(event),{beforeRpc:()=>{if(Date.now()-started>220000)throw Object.assign(new Error('达到本次采集安全时长，保留已保存的报价'),{code:'APP_TIME_BUDGET'});if(usage().tool_calls+usage().protocol_calls>=25)throw Object.assign(new Error('达到本批请求安全上限，保留已保存的报价'),{code:'APP_BATCH_LIMIT'});},beforeTool:()=>tracker.beforeTool(),observe:info=>tracker.observe(info)});
    const meta={fetched_at:new Date().toISOString(),batch_id:crypto.randomUUID(),currency:'CNY',schema_version:'buff-mcp-1.30.0/m1.4-quote',protocol_version:mcp.version};
    let payload;
    if(recovering) {
      const basic=await getBasicQuote(db,mcp,String(probeId),meta);
      payload=action==='inventory'?{items:[{...basic,errors:[{section:'detail',message:'恢复探测仅取得基础报价，历史与明细尚未加载'}]}],...meta,recovery_probe:true,scope:'一次基础报价恢复探测'}:{...basic,recovery_probe:true};
    }else if(action==='quote')payload=await getBasicQuote(db,mcp,id,meta);
    else if(action==='history'){
      const raw=await mcp.call('buff_get_price_history',{game:'csgo',goods_id:Number(id),days:body.days,currency:'CNY'});
      const saved={goods_id:id,series:history(raw,body.days,{...meta,tool:'buff_get_price_history',goods_id:id,variant_scope:'商品级'},Date.now()),fetched_at:new Date().toISOString()};
      if(!saved.series.some(line=>line.points?.length))throw Object.assign(new Error('本次没有有效历史点，保留已保存走势'),{code:'HISTORY_UNAVAILABLE'});
      await saveCache(db,`history:${id}:${body.days}`,'history',saved,{...meta,fetched_at:saved.fetched_at});payload=saved;
    }
    else {const name=body.kind==='sell'?'buff_get_sell_order':'buff_get_buy_order';const data=await mcp.call(name,{game:'csgo',goods_id:Number(id),page_num:page,page_size:body.kind==='sell'?10:5,...(body.kind==='sell'?{sort_by:'price.asc'}:{})});payload={...orders(data,body.kind,{...meta,tool:name}),...meta,page};}
    if((await db.MarketControl.get(control.id)).lease_token!==token)throw Object.assign(new Error('采集租约已失效，保留已保存报价'),{code:'COLLECTION_LEASE_LOST'});
    if(!recovering&&action==='orders'&&!payload.refresh_errors)await saveCache(db,key,action,payload,meta);
    const saved=await readSavedMarket(db,id);
    payload={...saved,...(action==='orders'?{order_page:payload}:{}),next_allowed_at:new Date(Date.parse(action==='quote'||recovering?saved.quote_fetched_at||meta.fetched_at:new Date().toISOString())+marketInterval).toISOString(),round_id:round.round_id,round_status:'success'};
    if(payload.refresh_errors?.length){failure=payload.refresh_errors.map(error=>error.message).join('；');failureCode='UPSTREAM_PARTIAL';}
    patch={...patch,retry_at:'',retry_basis:'',recovery_pending:false,rate_limit_streak:0,last_error:failure,last_error_code:failureCode,...(!failure||payload.quote_fetched_at?{last_success:payload.quote_fetched_at||meta.fetched_at}:{})};
    decision=recovering?'RECOVERY_PROBE_SUCCESS':failureCode||'SUCCESS';quoteResult=payload;
    return Response.json({...present(payload),request_usage:usage(),settings:{...settings(),running:false},request_id:requestId,quote_updated_this_request:!!payload.item&&Date.parse(payload.quote_fetched_at||payload.fetched_at)>=started});
  }catch(error) {
    failure=redact(error.message||'行情读取失败');failureCode=typeof error.code==='string'?error.code:'MARKET_ERROR';decision=failureCode;
    if(failureCode==='BUFF_RATE_LIMIT'&&control){patch={...patch,...retryPlan(error,control)};patch.rate_limit_evidence.source=body.source||'unknown';}
    if(control)patch={...patch,last_error:failure,last_error_code:failureCode};
    if(db&&body.goods_id)fallback=await readSavedMarket(db,String(body.goods_id));
    const common={settings:settings(),request_usage:usage(),request_id:requestId,error_code:failureCode,quote_updated_this_request:!!fallback&&Date.parse(fallback.quote_fetched_at||fallback.fetched_at)>=started};
    quoteResult=fallback;
    if(fallback)return Response.json({...present(fallback),...common,round_status:round?'failed':fallback.round_status,cached:true,stale:Date.now()-Date.parse(fallback.quote_fetched_at||fallback.fetched_at)>=marketInterval,refresh_error_code:failureCode,refresh_errors:[{code:failureCode,message:failure}],refresh_attempt_at:new Date().toISOString()});
    return Response.json({error:failure,...common},{status:failureCode==='BUFF_RATE_LIMIT'||failureCode==='APP_DAILY_BUDGET'?429:502});
  }finally {
    if(db&&round)await finishMarketRound(db,round,failureCode,failure,quoteResult?.quote_updated_this_request?quoteResult.quote_fetched_at:action==='quote'&&!failureCode?quoteResult?.quote_fetched_at:null);
    if(db&&control&&token)await db.MarketControl.updateMany({id:control.id,lease_token:token},{$set:{...(tracker?.snapshot()||{}),...patch,lease_until:'1970-01-01T00:00:00.000Z'}});
    if(db&&logEnabled){const s=settings(),u=usage();await writeRequestLog(db,{request_id:requestId,started_at:new Date(started).toISOString(),finished_at:new Date().toISOString(),source:['manual_watch','manual_detail','manual_inventory','scheduled_inventory','scheduled_queue','active_queue','manual_history','manual_orders','manual_scan','diagnostic'].includes(body.source)?body.source:'unknown',action,goods_ids:body.goods_ids||[String(body.goods_id||'')].filter(Boolean),decision,sent_buff:u.tool_calls+u.protocol_calls>0,tool_calls:u.tool_calls,protocol_calls:u.protocol_calls,error_code:failureCode,message:failure||(round?`轮次 ${round.round_id}`:fallback?.round_id?`复用轮次 ${fallback.round_id}`:''),retry_at:s?.retry_at||null,retry_basis:s?.retry_basis||null,events:tracker?.evidence()||[],required_calls:requiredCalls,used_calls:s?.used_calls||0,remaining_budget:s?.remaining_budget||0,quote_at:quoteResult?.quote_fetched_at||quoteResult?.fetched_at||null,quote_cents:quoteResult?.item?.sell_cents??null});}
  }
}