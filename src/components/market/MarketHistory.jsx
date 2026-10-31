import React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MarketCard from '@/components/market/MarketCard';
import WatchScope from '@/components/market/WatchScope';
import { categories, marketError } from '@/components/market/marketClient';
const patterns={knife:'刀|匕首|Knife|Bayonet|Karambit|Daggers',gun:'^(AK-47|AWP|M4A1|M4A4|SCAR-20|SG 553|法玛斯|FAMAS|G3SG1|加利尔|Galil|AUG|USP|Glock|格洛克|P2000|P250|P90|MP5|MP7|MP9|MAC-10|UMP|PP-Bizon|Tec-9|Five-SeveN|CZ75|R8|沙漠之鹰|Desert Eagle|双持贝瑞塔|Dual Berettas|Nova|新星|XM1014|Sawed-Off|MAG-7|M249|Negev|内格夫|SSG 08)',case:'胶囊|纪念包|武器箱|武器盒|钥匙|Capsule|Package|Case$|Case [(]',music:'音乐盒|Music Kit'};
export default function MarketHistory(){
  const [params,setParams]=useSearchParams(),group=patterns[params.get('history_group')]?params.get('history_group'):'all',search=(params.get('history_search')||'').slice(0,80);
  const query={kind:'detail'},conditions=[];
  if(group!=='all')conditions.push({$or:[{'payload.item.name':{$regex:patterns[group]}},{'payload.item.market_hash_name':{$regex:patterns[group]}}]});
  if(search){const term=search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');conditions.push({$or:[{'payload.item.name':{$regex:term}},{'payload.item.market_hash_name':{$regex:term}},{goods_id:search}]});}
  if(conditions.length)query.$and=conditions;
  const list=useInfiniteQuery({queryKey:['market-history',group,search],initialPageParam:undefined,queryFn:({pageParam})=>base44.entities.MarketCache.filter(query,{sort:'-fetched_at',limit:10,cursor:pageParam}),getNextPageParam:page=>page.has_more?page.next_cursor:undefined,retry:false,staleTime:60000,refetchOnWindowFocus:false});
  const count=useQuery({queryKey:['market-history-count',group,search],queryFn:()=>base44.entities.MarketCache.count(query),retry:false,staleTime:60000,refetchOnWindowFocus:false});
  const records=list.data?.pages.flatMap(page=>page.items)||[];
  const patch=values=>{const next=new URLSearchParams(params);Object.entries(values).forEach(([key,value])=>value?next.set(key,value):next.delete(key));setParams(next);};
  return <section className="space-y-4"><div className="rounded-xl border bg-card p-4 text-xs leading-6"><h2 className="font-semibold">已保存历史行情{count.data!=null?` · ${count.data}款`:''}</h2><p>原商品及7/30日走势按原采集时间保留，不因目录换页、预算不足或报价过期而隐藏；查看历史不请求BUFF，不把旧数据当作最新推荐。</p><p className="text-muted-foreground">未记录完整名称的商品保留在“全部”，不猜测分类；打开详情可查看该商品已保存的走势。</p></div><div className="grid grid-cols-5 gap-2">{[['all','全部'],...categories].map(([key,label])=><Button className="min-h-11 px-2" key={key} variant={group===key?'default':'outline'} onClick={()=>patch({history_group:key==='all'?'':key,history_search:''})}>{label}</Button>)}</div><form className="flex gap-2" onSubmit={event=>{event.preventDefault();patch({history_search:String(new FormData(event.currentTarget).get('search')||'').trim()});}}><Input key={search} name="search" maxLength={80} defaultValue={search} className="min-h-11" placeholder="搜索已保存的商品名称或ID"/><Button className="min-h-11" type="submit">搜索</Button></form>{list.isPending&&<p role="status" className="text-sm">正在读取原有历史行情…</p>}{(list.error||count.error)&&<p role="alert" className="text-sm text-destructive">{marketError(list.error||count.error)}</p>}<WatchScope ids={records.map(record=>record.goods_id||record.payload.goods_id)}><div className="space-y-4">{records.map(record=><MarketCard key={record.id} data={{...record.payload,historical_record:true}}/>)}</div></WatchScope>{!list.isPending&&!list.error&&!records.length&&<div className="rounded-xl border bg-card p-5 text-sm">当前筛选下没有已保存的历史记录。<Button variant="link" onClick={()=>patch({history_group:'',history_search:''})}>显示全部历史</Button></div>}{list.hasNextPage&&<Button className="min-h-11 w-full" variant="outline" disabled={list.isFetchingNextPage} onClick={()=>list.fetchNextPage()}>{list.isFetchingNextPage?'读取中…':'加载更早历史'}</Button>}</section>;
}