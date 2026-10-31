export const cents = value => value!==null && value!=='' && Number.isFinite(Number(value)) && Number(value)>0 ? Math.round(Number(value)*100) : null;
export const safeUrl = value => typeof value==='string' && /^https:\/\//i.test(value) ? value : null;
export function identity(raw,id) {return {goods_id:String(raw?.id??raw?.goods_id??id),name:raw?.name||`商品 #${id}`,market_hash_name:raw?.market_hash_name||'',sell_cents:cents(raw?.sell_min_price),buy_reference_cents:cents(raw?.buy_max_price),sell_num:raw?.sell_num??null,buy_num:raw?.buy_num??null,image:safeUrl(raw?.icon_url),source_updated_at:raw?.updated_at??null};}
export function orders(data,kind,meta) {return {total:data?.total_count??null,page:data?.page_num??1,items:(data?.items||[]).map(row=>({id:String(row.id),price_cents:cents(row.price),remaining:kind==='buy'&&[row.num,row.real_num,row.frozen_num].every(v=>Number.isFinite(v))?Math.max(0,row.num-row.real_num-row.frozen_num):null,conditions:row.specific??null,paintwear:row.asset_info?.paintwear??null,paintseed:row.asset_info?.info?.paintseed??null,paintindex:row.asset_info?.info?.paintindex??null,image:safeUrl(row.asset_info?.info?.icon_url),inspect_url:safeUrl(row.asset_info?.info?.inspect_url),source_updated_at:row.updated_at??null,created_at:row.created_at??null,source_path:'data.items',scope:'order',...meta}))};}
function timestamp(value) {if(typeof value!=='string')return null;const normalized=value.replace(' ','T');const ms=Date.parse(/Z$|[+-]\d\d:\d\d$/.test(normalized)?normalized:`${normalized}+08:00`);return Number.isFinite(ms)?ms:null;}
export function history(data,days,meta,T) {
  return (data?.lines||[]).filter(line=>['sell_min_price_history','buy_max_price_history'].includes(line.key)).map(line=>{
    const byTime=new Map(), conflicts=new Set();
    for(const raw of line.points||[]) {const time=timestamp(raw[0]),value=cents(raw[1]);if(time===null||time>T||value===null)continue;const prior=byTime.get(time);if(prior&&prior.value_cents!==value)conflicts.add(time);else byTime.set(time,{source_timestamp:new Date(time).toISOString(),value_cents:value,time});}
    return {series_type:line.key,name:line.name,query_window:days,conflicts:conflicts.size,points:[...byTime.values()].filter(p=>!conflicts.has(p.time)).sort((a,b)=>a.time-b.time),...meta,source_path:`data.lines[key=${line.key}].points`};
  });
}
export function metrics(series,T) {
  const line=series.find(l=>l.query_window===30&&l.series_type==='sell_min_price_history');const points=line?.points||[];const latest=points.at(-1);const result={r7:null,r30:null,base7:null,base30:null,ma7:null,ma30:null,days7:0,days30:0,drawdown:null,score:null,parts:null,status:'数据不足',reasons:[],risks:[],version:'trend_v1',source_latest:latest?.source_timestamp??null};
  const day=new Map(), dateKey=ms=>new Date(ms+8*3600000).toISOString().slice(0,10), start30=dateKey(T-29*86400000), start7=dateKey(T-6*86400000);
  for(const p of points){const key=dateKey(p.time);if(key>=start30)day.set(key,p);}
  const daily=[...day.values()];const week=daily.filter(p=>dateKey(p.time)>=start7);result.days7=week.length;result.days30=daily.length;
  for(const n of [7,30]) {const target=T-n*86400000,base=points.filter(p=>p.time<=target).at(-1);if(latest&&base&&target-base.time<=86400000){result[`r${n}`]=latest.value_cents/base.value_cents-1;result[`base${n}`]=base.source_timestamp;}}
  const avg=arr=>arr.length?arr.reduce((s,p)=>s+p.value_cents,0)/arr.length:null;result.ma7=avg(week);result.ma30=avg(daily);
  let peak=0,dd=0,jump=false;daily.forEach((p,i)=>{peak=Math.max(peak,p.value_cents);dd=Math.max(dd,1-p.value_cents/peak);if(i&&Math.abs(p.value_cents/daily[i-1].value_cents-1)>.2)jump=true;});result.drawdown=daily.length>1?dd:null;
  if(!latest||T-latest.time>86400000)result.risks.push('最新历史点超过24小时或缺失');
  if(result.days7<6)result.risks.push('7日有效天数不足6天');if(result.days30<24)result.risks.push('30日有效天数不足24天');
  if(result.r7===null||result.r30===null)result.risks.push('缺少24小时偏差以内的7/30日基准点');
  if(series.some(s=>s.conflicts))result.risks.push('同时间冲突点已隔离，需人工复核');
  const hot=result.r7>.15||jump;if(hot)result.risks.push('过热或相邻日报价异常跳变，需复核');
  if(result.r7!==null)result.reasons.push(`7日报价变化 ${(result.r7*100).toFixed(2)}%，基准 ${result.base7}`);
  if(result.ma7&&result.ma30)result.reasons.push(`MA7/MA30 = ${(result.ma7/result.ma30).toFixed(4)}，样本 ${week.length}/${daily.length} 天`);
  if(result.drawdown!==null)result.reasons.push(`30日有效报价最大回撤 ${(dd*100).toFixed(2)}%`);
  if(!result.risks.length) {const clip=v=>Math.min(100,Math.max(0,v));const p={M7:clip(50+500*result.r7),M30:clip(50+250*result.r30),A:clip(50+500*(result.ma7/result.ma30-1)),K:clip(100-500*dd),Q:Math.min(100,100*daily.length/30)};result.parts=p;result.score=Math.round((.25*p.M7+.2*p.M30+.2*p.A+.2*p.K+.15*p.Q)*10)/10;result.status='研究优选';}else if(result.days7>=6)result.status='观察';
  return result;
}