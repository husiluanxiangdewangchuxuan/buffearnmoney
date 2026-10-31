import React from 'react';
import quoteChartData from '@/components/market/quoteChartData';
export default function WatchSparkline({series=[]}) {
  const line=series.find(line=>line.series_type==='sell_min_price_history'&&line.query_window===7);
  const {rows,lines}=quoteChartData(line,null),points=line?.points||[];
  if(points.length<2)return <div className="hidden text-center text-[11px] text-muted-foreground md:block">走势待加载</div>;
  const values=points.map(p=>p.value_cents),min=Math.min(...values),max=Math.max(...values),start=rows[0].time,end=rows.at(-1).time;
  const tone=points.at(-1).value_cents>points[0].value_cents?'text-market-up':points.at(-1).value_cents<points[0].value_cents?'text-market-down':'text-muted-foreground';
  return <div className={`hidden md:block ${tone}`}><svg viewBox="0 0 120 40" className="h-10 w-full" role="img" aria-label="7日最低在售真实历史走势，缺失日期不连线">{lines.map(segment=><polyline key={segment.key} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" points={rows.filter(row=>row[segment.key]!=null).map(row=>`${4+(row.time-start)/(end-start||1)*112},${max===min?20:36-(row[segment.key]-min)/(max-min)*32}`).join(' ')}/>)}</svg><p className="text-center text-[10px] text-muted-foreground">7日最低在售</p></div>;
}