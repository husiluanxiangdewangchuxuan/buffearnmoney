import { identity, orders, metrics } from './marketNormalize.ts';
export async function quoteCache(db,id) {
  const rows=await db.MarketCache.filter({cache_key:{$in:[`quote:${id}`,`detail:${id}`]}},{sort:'-fetched_at',limit:4});
  return rows.items.filter(row=>Number.isSafeInteger(row.payload?.item?.sell_cents)&&row.payload.item.sell_cents>0).sort((a,b)=>Date.parse(b.payload.quote_fetched_at||b.payload.fetched_at)-Date.parse(a.payload.quote_fetched_at||a.payload.fetched_at))[0]||null;
}
export async function saveBasicQuote(db,id,data,meta,prior=null) {
  const rows=await db.MarketCache.filter({cache_key:`quote:${id}`},{limit:1});
  const previous=prior?.item||rows.items[0]?.payload?.item||{},raw=data?.goods_infos?.[id]||{},item=identity(raw,id);
  const at=new Date().toISOString(),source={...meta,fetched_at:at,tool:'buff_get_sell_order'};
  const first=orders(data,'sell',source).items.find(order=>Number.isSafeInteger(order.price_cents)&&order.price_cents>0);
  if(!first)throw Object.assign(new Error('基础在售报价未返回有效价格，保留上次成功报价'),{code:'QUOTE_UNAVAILABLE',status:502});
  item.sell_cents=first.price_cents;item.image=item.image||first.image||previous.image||null;
  if(item.name===`商品 #${id}`&&previous.name)item.name=previous.name;
  item.market_hash_name=item.market_hash_name||previous.market_hash_name||'';
  item.sell_num=data.total_count??item.sell_num;
  const payload={goods_id:String(id),item,...source,quote_fetched_at:at,source_updated_at:first.source_updated_at||null,quote_only:true,detail_complete:false,series:[],research:metrics([],Date.parse(at)),general_buy_cents:null,spread_cents:null,volume:null,errors:[],scope:'基础最低在售报价；未查询历史和订单明细',quote_scope:'商品级最低在售报价，非单件检视或通用求购核验'};
  const record={cache_key:`quote:${id}`,kind:'quote',goods_id:String(id),fetched_at:at,batch_id:meta.batch_id,payload};
  if(rows.items[0])await db.MarketCache.update(rows.items[0].id,record);else await db.MarketCache.create(record);
  return payload;
}
export async function getBasicQuote(db,mcp,id,meta) {
  const prior=await quoteCache(db,id);
  const data=await mcp.call('buff_get_sell_order',{game:'csgo',goods_id:Number(id),page_size:1,page_num:1,sort_by:'price.asc'});
  return saveBasicQuote(db,id,data,meta,prior?.payload);
}