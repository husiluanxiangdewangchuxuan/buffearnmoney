import { marketInterval } from './savedMarket.ts';
export async function runMarketQueue(client,ownerId) {
  if(!ownerId)return Response.json({updated:0,paused:true,message:'没有在线用户，不采集BUFF报价'});
  const db=client.asServiceRole.entities,control=(await db.MarketControl.filter({key:'market_m1'},{limit:1})).items[0];
  if(control?.retry_at&&Date.parse(control.retry_at)>Date.now())return Response.json({updated:0,paused:true,next_check_at:control.retry_at,message:'BUFF共享冷却期间只读历史，不启动新一轮'});
  if(control?.lease_until>new Date().toISOString())return Response.json({updated:0,merged:true,next_check_at:new Date(Date.now()+60000).toISOString(),message:'已有一轮正在执行，本次不重复采集'});
  const own={owner_id:ownerId};
  const groups=await Promise.all([db.StockItem.aggregate({query:own,groupBy:'goods_id'}),db.MarketWatch.aggregate({query:{...own,monitoring:{$ne:false}},groupBy:'goods_id'}),db.PurchaseCandidate.aggregate({query:own,groupBy:'goods_id'})]);
  const ids=[...new Set(groups.flatMap(group=>group.rows.map(row=>String(row.goods_id))).filter(id=>/^\d{1,12}$/.test(id)))];
  if(!ids.length)return Response.json({updated:0,next_check_at:new Date(Date.now()+marketInterval).toISOString(),message:'当前用户没有需要更新的库存、自选或采购候选，不请求BUFF'});
  const cached=await db.MarketCache.aggregate({query:{goods_id:{$in:ids},kind:{$in:['quote','detail','market_round']}},groupBy:'goods_id',max:['fetched_at']});
  const latest=new Map(cached.rows.map(row=>[String(row.goods_id),Date.parse(row.max_fetched_at)||0])),seen=new Set(),queue=[];
  groups.forEach((group,priority)=>{const goods=group.rows.map(row=>String(row.goods_id)).filter(id=>/^\d{1,12}$/.test(id)&&!seen.has(id));goods.sort((a,b)=>(latest.get(a)||0)-(latest.get(b)||0));for(const id of goods){seen.add(id);if(Date.now()-(latest.get(id)||0)>=marketInterval)queue.push({id,priority});}});
  const outcomes=[];
  for(const entry of queue.slice(0,3)) {
    if(outcomes.length)await new Promise(resolve=>setTimeout(resolve,2000));
    const result=await client.functions.invoke('marketData',{action:'quote',goods_id:entry.id,refresh:true,source:'active_queue'}).catch(error=>({data:error.response?.data||{error:error.message}}));
    outcomes.push({goods_id:entry.id,priority:['库存','自选','采购候选'][entry.priority],round_id:result.data.round_id,decision:result.data.decision,request_usage:result.data.request_usage,error:result.data.error||result.data.refresh_errors?.[0]?.message||null});
    if(result.data.next_allowed_at)latest.set(entry.id,Date.parse(result.data.next_allowed_at)-marketInterval);
    if(result.data.settings?.retry_at&&Date.parse(result.data.settings.retry_at)>Date.now())return Response.json({updated:outcomes.filter(row=>row.request_usage?.tool_calls>0&&!row.error).length,paused:true,next_check_at:result.data.settings.retry_at,outcomes});
    if(result.data.error||result.data.refresh_errors?.length||result.data.round_status==='running')break;
  }
  const next=Math.max(Date.now()+60000,Math.min(...ids.map(id=>(latest.get(id)||0)+marketInterval)));
  return Response.json({updated:outcomes.filter(row=>row.request_usage?.tool_calls>0&&!row.error).length,pending:Math.max(0,queue.length-outcomes.length),next_check_at:new Date(next).toISOString(),outcomes,message:'仅当前在线用户的库存、自选和采购候选参与更新；同款全应用共用60分钟窗口，无人使用时停止自动采集'});
}