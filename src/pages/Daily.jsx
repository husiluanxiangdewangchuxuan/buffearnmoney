import React from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PageHeading from '@/components/stock/PageHeading';
import StockSummary from '@/components/stock/StockSummary';
import ImportHistory from '@/components/stock/ImportHistory';
import DailyReportCard from '@/components/daily/DailyReportCard';
import { marketError } from '@/components/market/marketClient';
export default function Daily(){
  const client=useQueryClient();
  const read=async payload=>{const {data}=await base44.functions.invoke('inventoryResearch',payload);if(data.error)throw new Error(data.error);return data;};
  const query=useInfiniteQuery({queryKey:['daily-reports'],initialPageParam:undefined,queryFn:({pageParam})=>read({action:'daily_read',cursor:pageParam}),getNextPageParam:page=>page.has_more?page.next_cursor:undefined,retry:false,refetchOnWindowFocus:false});
  const refresh=useMutation({retry:false,mutationFn:()=>read({action:'daily_refresh'}),onSuccess:()=>client.invalidateQueries({queryKey:['daily-reports']})});
  const reports=query.data?.pages.flatMap(page=>page.items)||[];
  return <><PageHeading eyebrow="DAILY / 行情留痕" title="行情日报与历史记录" description="北京时间每天16:00分界。首次刷新归档上一份，昨晚已生成的日报持续可见；再次刷新也保留前一份。刷新日报只归档已保存行情，不请求BUFF。"/><Button className="mb-4 min-h-11" disabled={refresh.isPending} onClick={()=>refresh.mutate()}>{refresh.isPending?'归档中…':'刷新并归档日报'}</Button>{(refresh.error||query.error)&&<p role="alert" className="mb-4 text-sm text-destructive">{marketError(refresh.error||query.error)}</p>}{query.isPending&&<p>正在读取已归档日报…</p>}<div className="space-y-4">{reports.map(report=><DailyReportCard key={report.id} report={report}/>)}</div>{!query.isPending&&!query.error&&!reports.length&&<p className="mb-5 rounded-xl border bg-card p-5 text-sm">当前应用尚无已归档的行情日报，未找到昨晚已生成的日报，不补造历史。点击上方按钮可保存当前已有行情的首份日报。</p>}{query.hasNextPage&&<Button className="my-4" variant="outline" disabled={query.isFetchingNextPage} onClick={()=>query.fetchNextPage()}>加载更早日报</Button>}<div className="mt-5 space-y-5"><StockSummary/><ImportHistory/></div></>;
}