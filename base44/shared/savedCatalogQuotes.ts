export async function readSavedCatalogQuotes(db,ids) {
  const remaining=new Set(ids.map(String)),found=new Map();
  if(!remaining.size)return found;
  let cursor;
  do {
    const page=await db.MarketCache.filter({kind:'catalog','payload.items.goods_id':{$in:ids}},{sort:'-fetched_at',limit:50,...(cursor?{cursor}:{})});
    for(const record of page.items)for(const saved of record.payload?.items||[]) {
      const id=String(saved.goods_id),at=saved.quote_fetched_at||saved.fetched_at||record.fetched_at;
      if(!remaining.has(id)||!Number.isSafeInteger(saved.item?.sell_cents)||saved.item.sell_cents<=0||!Number.isFinite(Date.parse(at)))continue;
      found.set(id,{...saved,goods_id:id,fetched_at:at,quote_fetched_at:at,quote_only:true,tool:'buff_get_market_goods',quote_scope:'已保存目录商品级参考报价，非独立在售订单采集'});
      remaining.delete(id);
    }
    cursor=page.has_more?page.next_cursor:null;
  }while(cursor&&remaining.size);
  return found;
}