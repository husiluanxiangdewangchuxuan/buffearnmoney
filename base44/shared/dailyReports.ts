import { combineSaved } from './savedMarket.ts';
export const reportPeriod=(now=Date.now())=>new Date(now-8*3600000).toISOString().slice(0,10);
export async function dailyReports(client,user,body) {
  const db=client.asServiceRole.entities;
  if(body.action==='daily_read')return Response.json(await db.DailyReport.filter({owner_id:user.id},{sort:'-generated_at',limit:10,cursor:body.cursor}));
  const control=(await db.MarketControl.filter({key:'market_m1'},{limit:1})).items[0];
  if(!control||control.lease_until>new Date().toISOString())return Response.json({error:'采集正在进行，请稍后归档日报；历史仍可查看'},{status:409});
  const token=crypto.randomUUID();
  await db.MarketControl.updateMany({id:control.id,lease_token:control.lease_token,lease_until:control.lease_until},{$set:{lease_token:token,lease_until:new Date(Date.now()+60000).toISOString()}});
  if((await db.MarketControl.get(control.id)).lease_token!==token)return Response.json({error:'另一项操作正在归档，请稍后重读'},{status:409});
  try {
    const sets=await Promise.all([db.StockItem.aggregate({query:{owner_id:user.id},groupBy:'goods_id'}),db.MarketWatch.aggregate({query:{owner_id:user.id},groupBy:'goods_id'}),db.PurchaseCandidate.aggregate({query:{owner_id:user.id},groupBy:'goods_id'})]);
    const all=[...new Set(sets.flatMap(group=>group.rows.map(row=>row.goods_id)).filter(id=>/^\d{1,12}$/.test(String(id))))],ids=all.slice(0,100);
    const keys=ids.flatMap(id=>[`quote:${id}`,`detail:${id}`,`history:${id}:7`,`history:${id}:30`]);
    const cached=keys.length?(await db.MarketCache.filter({cache_key:{$in:keys}},{sort:'-fetched_at',limit:500})).items:[];
    const rows=ids.map(id=>{const data=combineSaved(id,cached);return {goods_id:id,name:data.item.name,sell_cents:data.item.sell_cents,quote_at:data.quote_fetched_at,r7:data.research?.r7??null,r30:data.research?.r30??null,history_times:data.history_times};});
    const report=await db.DailyReport.create({owner_id:user.id,period:reportPeriod(),generated_at:new Date().toISOString(),archived:false,rows,scope_note:`仅归档已有行情，不请求BUFF；覆盖库存、自选和采购候选${ids.length}款${all.length>ids.length?`，其余${all.length-ids.length}款未纳入本份快照`:''}；无报价如实留空。`});
    const archiveQuery={owner_id:user.id,archived:false,id:{$ne:report.id}};
    let result;do{result=await db.DailyReport.updateMany(archiveQuery,{$set:{archived:true}});}while(result.has_more);
    return Response.json({report});
  }finally{await db.MarketControl.updateMany({id:control.id,lease_token:token},{$set:{lease_until:'1970-01-01T00:00:00.000Z'}});}
}