import { metrics } from './marketNormalize.ts';
import { readSavedCatalogQuotes } from './savedCatalogQuotes.ts';
export const marketInterval=60*60*1000;
export function combineSaved(id,records) {
  const row=key=>records.find(record=>record.cache_key===key)?.payload;
  const detail=row(`detail:${id}`)||{},quote=row(`quote:${id}`),round=row(`round:${id}`);
  const latest=[quote,detail].filter(data=>Number.isSafeInteger(data?.item?.sell_cents)&&data.item.sell_cents>0).sort((a,b)=>Date.parse(b.quote_fetched_at||b.fetched_at)-Date.parse(a.quote_fetched_at||a.fetched_at))[0];
  const series=[...(detail.series||[])];
  for(const days of [7,30]){const saved=row(`history:${id}:${days}`);if(saved){for(let i=series.length-1;i>=0;i--)if(series[i].query_window===days)series.splice(i,1);series.push(...saved.series);}}
  const at=latest?.quote_fetched_at||latest?.fetched_at||null;
  const roundAt=round?.status==='success'?round.finished_at:round?.started_at;
  const next=Math.max((Date.parse(roundAt)||0)+(roundAt?marketInterval:0),at?Date.parse(at)+marketInterval:0);
  const sell=row(`orders:${id}:sell:1`)||detail.sell,buy=row(`orders:${id}:buy:1`)||detail.buy;
  const general=(buy?.items||[]).filter(order=>Array.isArray(order.conditions)&&!order.conditions.length&&order.remaining>0&&Number.isSafeInteger(order.price_cents)&&order.price_cents>0);
  const verified=buy?(general.length?Math.max(...general.map(order=>order.price_cents)):null):detail.general_buy_cents??null;
  return {...detail,...latest,goods_id:String(id),item:latest?.item||detail.item||{goods_id:String(id),name:`商品 #${id}`,sell_cents:null},series,research:series.length?metrics(series,Date.now()):detail.research||metrics([],Date.now()),sell,buy,buy_fetched_at:buy?.fetched_at||detail.buy_fetched_at||null,research_fetched_at:detail.research_fetched_at||null,history_times:Object.fromEntries([7,30].map(days=>[days,row(`history:${id}:${days}`)?.fetched_at||series.find(line=>line.query_window===days)?.fetched_at||detail.research_fetched_at||null])),general_buy_cents:verified,spread_cents:latest?.item?.sell_cents!=null&&verified!=null?latest.item.sell_cents-verified:null,fetched_at:at,quote_fetched_at:at,empty:!at,cached:true,stale:!!at&&Date.now()-Date.parse(at)>=marketInterval,next_allowed_at:next?new Date(next).toISOString():null,round_id:round?.round_id||null,round_status:round?.status||null,refresh_errors:round?.status==='failed'?[{code:round.error_code,message:round.message}]:[]};
}
export async function readSavedMarkets(db,ids) {
  if(!ids.length)return [];
  const keys=ids.flatMap(id=>[`quote:${id}`,`detail:${id}`,`round:${id}`,`history:${id}:7`,`history:${id}:30`,`orders:${id}:sell:1`,`orders:${id}:buy:1`]);
  const records=(await db.MarketCache.filter({cache_key:{$in:keys}},{sort:'-fetched_at',limit:350})).items;
  const results=ids.map(id=>combineSaved(id,records)),missing=results.filter(item=>item.empty).map(item=>item.goods_id);
  const catalog=await readSavedCatalogQuotes(db,missing);
  return results.map(result=>catalog.has(result.goods_id)?combineSaved(result.goods_id,[...records,{cache_key:`quote:${result.goods_id}`,payload:catalog.get(result.goods_id)}]):result);
}
export async function readSavedMarket(db,id) {
  return (await readSavedMarkets(db,[String(id)]))[0];
}
export async function startMarketRound(db,id,action,source) {
  const now=Date.now(),payload={round_id:crypto.randomUUID(),goods_id:String(id),action,source,status:'running',started_at:new Date(now).toISOString(),next_allowed_at:new Date(now+marketInterval).toISOString()};
  const record={cache_key:`round:${id}`,kind:'market_round',goods_id:String(id),fetched_at:payload.started_at,batch_id:payload.round_id,payload};
  const old=(await db.MarketCache.filter({cache_key:record.cache_key},{limit:1})).items[0];
  const saved=old?await db.MarketCache.update(old.id,record):await db.MarketCache.create(record);
  return {...payload,record_id:saved.id};
}
export async function finishMarketRound(db,round,errorCode,message,quoteAt) {
  const {record_id,...payload}=round;
  payload.status=errorCode?'failed':'success';payload.error_code=errorCode;payload.message=message;payload.finished_at=new Date().toISOString();
  if(!errorCode)payload.next_allowed_at=new Date(Date.parse(quoteAt||payload.finished_at)+marketInterval).toISOString();
  await db.MarketCache.update(record_id,{payload});
}