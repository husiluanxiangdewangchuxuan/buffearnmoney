import { identity, orders, history, metrics } from './marketNormalize.ts';
import { quoteCache, saveBasicQuote } from './marketQuote.ts';
export const groups = {knife:{category_group:'knife'}, gun:{category_group:'rifle'}, case:{category:'csgo_type_weaponcase'}, music:{category:'csgo_type_musickit'}};
export const gunGroups=['rifle','pistol','smg','shotgun','machinegun'];
export async function readCache(db,key) {const rows=await db.MarketCache.filter({cache_key:key},{sort:'-fetched_at',limit:1});const record=rows.items[0]||null;if(record?.payload){const refresh=p=>{if(p.series){
      const expired=p.research_fetched_at&&Date.now()-Date.parse(p.research_fetched_at)>=3600000;
      if(expired)p.historical_research=true;
      p.research=metrics(p.series,Date.parse(p.research_fetched_at||p.fetched_at));
      if(expired)p.research.risks.push('走势持续保留，已超过60分钟，以各分项采集时间为准；目录报价不能代替历史证据');if(p.errors?.length){p.research.score=null;p.research.parts=null;p.research.status='观察';p.research.risks.push('部分接口未成功，单件条件尚未完整核验');}}};refresh(record.payload);record.payload.items?.forEach(refresh);}return record;}
export async function saveCache(db,key,kind,payload,meta) {const old=await readCache(db,key);const record={cache_key:key,kind,goods_id:payload.goods_id||'',fetched_at:meta.fetched_at,batch_id:meta.batch_id,payload};if(old)await db.MarketCache.update(old.id,record);else await db.MarketCache.create(record);}
export async function getDetail(db,mcp,id,raw,meta,force=false) {
  const old=await readCache(db,`detail:${id}`);
  if(old&&!force&&old.payload.detail_complete!==false&&Date.now()-Date.parse(old.payload.detail_fetched_at||old.fetched_at)<900000)return old.payload;
  const priorQuote=await quoteCache(db,id),data={},errors=[];let basic=null;
  try {
    data.sell=await mcp.call('buff_get_sell_order',{game:'csgo',goods_id:Number(id),page_size:10,page_num:1,sort_by:'price.asc'});
    basic=await saveBasicQuote(db,id,data.sell,meta,priorQuote?.payload||old?.payload);
  }catch(error){errors.push({section:'sell',message:error.message,code:error.code||null});}
  const tasks=[['buy','buff_get_buy_order',{goods_id:Number(id),page_size:5,page_num:1}],['h7','buff_get_price_history',{goods_id:Number(id),days:7,currency:'CNY'}],['h30','buff_get_price_history',{goods_id:Number(id),days:30,currency:'CNY'}]];
  for(const [section,name,args] of tasks) {
    if(mcp.stopped){errors.push({section,message:'上游已要求暂停，未发送该项请求',code:'NOT_SENT'});continue;}
    try {data[section]=await mcp.call(name,{game:'csgo',...args});}catch(error){errors.push({section,message:error.message,code:error.code||null});}
  }
  if(!Object.keys(data).length){if(mcp.stopped)throw mcp.stopped;throw Object.assign(new Error(errors[0]?.message||'未取得详情数据'),{code:errors[0]?.code||'DETAIL_UNAVAILABLE'});}
  const item={...(basic?.item||priorQuote?.payload?.item||old?.payload?.item||identity(raw||{},id))};
  const sell=data.sell?orders(data.sell,'sell',{...meta,tool:'buff_get_sell_order'}):old?.payload?.sell;
  const buy=data.buy?orders(data.buy,'buy',{...meta,tool:'buff_get_buy_order'}):old?.payload?.buy;
  const common={...meta,tool:'buff_get_price_history',goods_id:String(id),variant_scope:'商品级'};
  const series=[];
  for(const [section,days] of [['h7',7],['h30',30]])series.push(...(data[section]?history(data[section],days,common,Date.parse(meta.fetched_at)):(old?.payload?.series||[]).filter(line=>line.query_window===days)));
  const seen=new Map(),conflicts=new Set();for(const line of series)for(const point of line.points){const key=`${line.series_type}:${point.time}`;if(seen.has(key)&&seen.get(key)!==point.value_cents)conflicts.add(key);else seen.set(key,point.value_cents);}for(const line of series){const before=line.points.length;line.points=line.points.filter(point=>!conflicts.has(`${line.series_type}:${point.time}`));line.conflicts+=before-line.points.length;}
  const research=metrics(series,Date.now());
  if(errors.length){research.status='观察';research.score=null;research.parts=null;research.risks.push('部分详情未成功，旧分项保留并以原采集时间为准');}
  const general=data.buy?(buy?.items||[]).filter(order=>Array.isArray(order.conditions)&&!order.conditions.length&&order.remaining>0&&order.price_cents!==null):[];
  const verified=general.length?Math.max(...general.map(order=>order.price_cents)):null;
  const quoteAt=basic?.fetched_at||priorQuote?.payload?.quote_fetched_at||priorQuote?.payload?.fetched_at||null;
  const complete=errors.length===0;
  const payload={goods_id:String(id),item,sell,buy,series,research,general_buy_cents:verified,spread_cents:item.sell_cents!=null&&verified!=null?item.sell_cents-verified:null,errors,...meta,fetched_at:quoteAt||meta.fetched_at,quote_fetched_at:quoteAt,detail_fetched_at:complete?new Date().toISOString():old?.payload?.detail_fetched_at||null,detail_complete:complete,research_fetched_at:complete?meta.fetched_at:old?.payload?.research_fetched_at||old?.fetched_at||null,buy_fetched_at:data.buy?meta.fetched_at:old?.payload?.buy_fetched_at||old?.fetched_at||null,tool:'buff_get_sell_order + buff_get_buy_order + buff_get_price_history',source_updated_at:null,scope:'商品报价 / 按需详情',volume:null,...(!complete?{refresh_errors:errors,refresh_attempt_at:meta.fetched_at}:{}),stale:!basic};
  await saveCache(db,`detail:${id}`,'detail',payload,{...meta,fetched_at:quoteAt||meta.fetched_at});
  if(mcp.stopped)throw mcp.stopped;
  return payload;
}
export async function getCatalog(db,mcp,input,meta) {
  const args={game:'csgo',page_num:input.page,page_size:5,sort_by:'time',...groups[input.group],...(input.group==='gun'?{category_group:input.gunGroup}:{}),...(input.search?{search:input.search}:{})};
  const data=await mcp.call('buff_get_market_goods',args);
  const unique=[...new Map((data.items||[]).map(x=>[String(x.id),x])).values()];
  const cached=unique.length?await db.MarketCache.filter({cache_key:{$in:unique.map(raw=>`detail:${raw.id}`)}},{sort:'-fetched_at',limit:10}):{items:[]};
  const snapshots=new Map();
  for(const record of cached.items)if(!snapshots.has(record.cache_key))snapshots.set(record.cache_key,record);
  const items=unique.map(raw=>{
    const record=snapshots.get(`detail:${raw.id}`),snapshot=record?.payload;
    const age=record?Date.parse(meta.fetched_at)-Date.parse(record.fetched_at):Infinity;
    const fresh=age>=0&&age<900000&&!snapshot?.stale;
    const item=identity(raw,raw.id);item.image=item.image||snapshot?.item?.image||null;
    const research=fresh&&snapshot?.research?snapshot.research:metrics([],Date.parse(meta.fetched_at));
    if(!fresh)research.risks.push('尚无有效详情缓存，打开详情按需读取7/30日历史与订单');
    const verified=fresh&&!snapshot?.errors?.length?snapshot?.general_buy_cents??null:null;
    return {goods_id:String(raw.id),item,research,series:fresh?snapshot.series||[]:[],general_buy_cents:verified,spread_cents:item.sell_cents!==null&&verified!==null?item.sell_cents-verified:null,errors:fresh?snapshot.errors||[]:[],...meta,tool:'buff_get_market_goods',source_updated_at:item.source_updated_at,research_fetched_at:fresh?snapshot.fetched_at:null,research_batch_id:fresh?snapshot.batch_id:null,quote_scope:'目录商品级参考；求购与研究仅复用15分钟内详情缓存'};
  });
  return {items,total:data.total_count??null,page:data.page_num??input.page,total_pages:data.total_page??null,returned:items.length,group:input.group,search:input.search,...meta,errors:items.flatMap(x=>x.errors||[]),scope:'当前目录页，不是全市场扫描或推荐批次',gun_scope:input.group==='gun'?`当前枪类 ${input.gunGroup}，总数仅指该枪类目录，不是全部枪皮覆盖`:null};
}