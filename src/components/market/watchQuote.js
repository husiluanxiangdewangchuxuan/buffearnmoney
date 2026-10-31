export const validPrice=value=>Number.isSafeInteger(value)&&value>0;
export function watchSnapshot(data) {
  if(!data?.item)return {};
  const fresh=!data.stale&&Number.isFinite(Date.parse(data.fetched_at))&&Date.now()-Date.parse(data.fetched_at)<3600000;
  return {watch_price_cents:fresh&&validPrice(data.item.sell_cents)?data.item.sell_cents:null,watch_quote_at:data.fetched_at||'',quote_snapshot:{goods_id:String(data.goods_id),item:data.item,fetched_at:data.fetched_at,stale:!!data.stale,general_buy_cents:data.general_buy_cents??null,research_fetched_at:data.research_fetched_at||null,buy:{items:(data.buy?.items||[]).slice(0,3)},research:{reasons:(data.research?.reasons||[]).slice(0,2)},volume:data.volume??null}};
}
export function latestWatchQuote(watch,...quotes) {
  const available=[...quotes,watch.quote_snapshot].filter(q=>q?.item&&validPrice(q.item.sell_cents)&&Number.isFinite(Date.parse(q.quote_fetched_at||q.fetched_at))).sort((a,b)=>Date.parse(b.quote_fetched_at||b.fetched_at)-Date.parse(a.quote_fetched_at||a.fetched_at));
  const latest=available[0],detail=available.find(q=>q.series?.length);
  if(!latest)return null;
  if(latest.quote_only&&detail)return {...detail,...latest,series:detail.series,research:detail.research,research_fetched_at:detail.research_fetched_at||detail.fetched_at,buy:detail.buy,buy_fetched_at:detail.buy_fetched_at||detail.research_fetched_at||detail.fetched_at,general_buy_cents:detail.general_buy_cents??null};
  return latest;
}
export function watchDifference(watch,quote) {
  if(!validPrice(watch.watch_price_cents)||!validPrice(quote?.item?.sell_cents))return null;
  const cents=quote.item.sell_cents-watch.watch_price_cents;
  return {cents,percent:cents/watch.watch_price_cents*100,label:cents>0?'上涨':cents<0?'下跌':'持平',tone:cents>0?'text-market-up':cents<0?'text-market-down':'text-muted-foreground',badge:cents>0?'bg-market-up text-primary-foreground':cents<0?'bg-market-down text-primary-foreground':'bg-muted text-muted-foreground'};
}
export function watchSpecs(item,name) {
  const source=`${name||''} ${item?.market_hash_name||''}`;
  const wear=source.match(/崭新出厂|略有磨损|久经沙场|破损不堪|战痕累累|Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred/)?.[0];
  const edition=/StatTrak|暗金/i.test(source)?'StatTrak':/Souvenir|纪念品/i.test(source)?'纪念品':'普通款（非StatTrak）';
  return [wear,edition].filter(Boolean).join(' · ');
}