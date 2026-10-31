import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MarketImage from '@/components/market/MarketImage';
import WatchButton from '@/components/market/WatchButton';
import WatchSparkline from '@/components/market/WatchSparkline';
import WatchEvidence from '@/components/market/WatchEvidence';
import { latestWatchQuote, watchDifference, watchSpecs, validPrice } from '@/components/market/watchQuote';
import { marketCall, marketError, price, time } from '@/components/market/marketClient';
import QuoteRefreshControl from '@/components/market/QuoteRefreshControl';
export default function WatchlistRow({watch,cachedQuote,refreshState}) {
  const quote=latestWatchQuote(watch,cachedQuote),item=quote?.item||watch.quote_snapshot?.item||{},name=watch.name||item.name||`商品 #${watch.goods_id}`;
  const difference=watchDifference(watch,quote),stale=!quote||quote.stale||Date.now()-Date.parse(quote.fetched_at)>=3600000;
  const researchTime=quote?.buy_fetched_at||quote?.research_fetched_at||quote?.fetched_at,buyFresh=Date.now()-Date.parse(researchTime)<3600000;
  const errors=quote?.refresh_errors?.filter(error=>error.code!=='UPSTREAM_COOLDOWN'||refreshState?.waiting).map(error=>error.message).join('；');

  return <article className="border-b px-4 py-4 last:border-b-0 sm:px-5">
    <div className="grid grid-cols-2 items-center gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem]">
      <Link to={`/market/${watch.goods_id}?returnTo=%2Fwatchlist`} className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1"><MarketImage key={item.image||watch.goods_id} src={item.image} name={name} compact/><div className="min-w-0"><h2 className="break-words text-sm font-semibold leading-5 text-primary">{name}</h2><p className="mt-1 break-words text-[11px] leading-4 text-muted-foreground">#{watch.goods_id} · {watchSpecs(item,name)}</p></div></Link>
      <WatchSparkline series={quote?.series||[]}/>
      <div className="text-left md:text-right"><p className="mb-1 text-[11px] text-muted-foreground md:hidden">最低在售</p><strong className={`text-xl font-semibold tabular-nums ${difference?.tone||'text-foreground'}`}>{quote?price(quote.item.sell_cents):'暂无报价'}</strong><p className="mt-1 text-[10px] text-muted-foreground">{quote?.tool==='buff_get_market_goods'?'目录报价 · ':''}{stale?'历史报价 / 待更新':'60分钟窗口内的已保存报价'}</p></div>
      <div className="text-right"><p className="mb-1 text-[11px] text-muted-foreground md:hidden">较收藏涨跌</p>{difference?<><span className={`inline-block min-w-24 rounded-md px-2 py-2 text-center text-base font-semibold tabular-nums ${difference.badge}`}>{difference.percent>0?'+':''}{difference.percent.toFixed(2)}%</span><p className={`mt-1 text-[11px] tabular-nums ${difference.tone}`}>{difference.label} {difference.cents>0?'+':difference.cents<0?'-':''}{price(Math.abs(difference.cents))}</p></>:<p className="text-xs text-muted-foreground">{validPrice(watch.watch_price_cents)?'等待当前报价':'收藏基准未记录'}</p>}</div>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"><p>已核实首屏通用求购 <strong>{validPrice(quote?.general_buy_cents)?price(quote.general_buy_cents):'待核实'}</strong>{!buyFresh&&validPrice(quote?.general_buy_cents)&&<span className="text-muted-foreground">（历史）</span>}</p><p className="text-muted-foreground">成交量 {quote?.volume==null?'未提供':String(quote.volume)}</p></div>
    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">收藏参考价 {validPrice(watch.watch_price_cents)?price(watch.watch_price_cents):'未记录，不能追溯涨跌'} · 收藏于 {time(watch.watched_at||watch.created_date)}</p>
    <p className="text-[11px] leading-5 text-muted-foreground">{quote?<>最近成功报价时间 {time(quote.quote_fetched_at||quote.fetched_at)}</>:'尚未取得首份报价'}{validPrice(watch.watch_price_cents)&&watch.watch_quote_at?` · 收藏基准报价采集于 ${time(watch.watch_quote_at)}`:''}</p>
    <div className="mt-2 flex items-center justify-between gap-3"><Link className="min-h-11 py-3 text-xs text-primary underline" to={`/market/${watch.goods_id}?returnTo=%2Fwatchlist`}>查看详情与走势</Link><div className="flex gap-2"><QuoteRefreshControl data={cachedQuote||quote} goodsId={watch.goods_id} source="manual_watch"/><WatchButton goodsId={watch.goods_id} name={name} record={watch}/></div></div>
    <WatchEvidence quote={quote}/>
    {errors&&<p role="alert" className="mt-2 text-xs leading-5 text-destructive">上次更新未完成：{errors}。保留已有报价，未重设收藏基准。</p>}
  </article>;
}