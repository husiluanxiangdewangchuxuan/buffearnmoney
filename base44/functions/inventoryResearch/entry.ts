import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { researchInventory } from '../../shared/inventoryAgent.ts';
import { dailyReports } from '../../shared/dailyReports.ts';
import { runMarketQueue } from '../../shared/marketQueue.ts';
export default async function(req) {
  let db,tracking,token;
  try {
    const client=createClientFromRequest(req),user=await client.auth.me().catch(e=>e.status===401?null:Promise.reject(e));
    if(!user)return Response.json({error:'请先登录'},{status:401});
    const body=await req.json().catch(()=>({})),action=body.action||'status';
    if(['daily_read','daily_refresh'].includes(action))return await dailyReports(client,user,body);
    if(action==='scheduled'){if(user.role!=='admin')return Response.json({error:'仅管理员可运行后台队列'},{status:403});return Response.json({updated:0,paused:true,message:'无人在线时的定时采集已停用，仅App前台在线时每60分钟更新'});}
    if(action==='active_tick')return await runMarketQueue(client,user.id);
    if(!['status','refresh'].includes(action))return Response.json({error:'不支持的研究操作'},{status:400});
    if(action==='scheduled'&&user.role!=='admin')return Response.json({error:'仅管理员可运行后台追踪'},{status:403});
    db=client.asServiceRole.entities;
    tracking=(await db.MarketControl.filter({key:`inventory_tracking:${user.id}`},{limit:1})).items[0];
    if(action==='status')return Response.json({cadence_hours:1,last_success:tracking?.last_success||null,last_error:tracking?.last_error||null,running:!!(tracking?.lease_until&&tracking.lease_until>new Date().toISOString()),schedule:'仅App前台在线时更新；同款报价满60分钟后错峰采集，库存优先，其次自选、采购候选；无人使用时停止',scope:'全应用按BUFF商品ID共用基础报价轮次'});
    let ids;
    if(action==='refresh') {
      ids=body.goods_ids;
      if(!Array.isArray(ids)||!ids.length||ids.length>5||ids.some(x=>typeof x!=='string'||!/^\d{1,12}$/.test(x))||new Set(ids).size!==ids.length)return Response.json({error:'一次请选择1至5个商品'},{status:400});
      const owned=await db.StockItem.aggregate({query:{owner_id:user.id,goods_id:{$in:ids}},groupBy:'goods_id'});
      if(ids.some(id=>!owned.rows.some(x=>x.goods_id===id)))return Response.json({error:'只能研究自己的库存商品'},{status:403});
    } else {
      const grouped=await db.StockItem.aggregate({query:{owner_id:user.id},groupBy:'goods_id'});
      ids=grouped.rows.map(x=>x.goods_id).filter(id=>/^\d{1,12}$/.test(id));
    }
    if(!ids.length)return Response.json({updated:0,message:'当前没有需要追踪的库存商品'});
    if(!tracking)tracking=await db.MarketControl.create({key:`inventory_tracking:${user.id}`,daily_limit:0,calls:0,lease_until:'1970-01-01T00:00:00.000Z',lease_token:''});
    if(tracking.lease_until>new Date().toISOString())return Response.json({error:'库存研究正在进行，请稍后刷新数据'},{status:409});
    token=crypto.randomUUID();
    await db.MarketControl.updateMany({id:tracking.id,lease_token:tracking.lease_token,lease_until:tracking.lease_until},{$set:{lease_token:token,lease_until:new Date(Date.now()+300000).toISOString()}});
    if((await db.MarketControl.get(tracking.id)).lease_token!==token){token=null;return Response.json({error:'其他窗口已启动研究'},{status:409});}
    const cached=(await db.MarketCache.filter({cache_key:{$in:ids.slice(0,100).map(id=>`detail:${id}`)}},{limit:100})).items;
    ids.sort((a,b)=>(Date.parse(cached.find(x=>x.goods_id===a)?.fetched_at)||0)-(Date.parse(cached.find(x=>x.goods_id===b)?.fetched_at)||0));
    const target=ids.slice(0,20),started=Date.now(),errors=[];let updated=0,reports=0,reused=0;
    for(let i=0;i<target.length;i+=5) {
      if(Date.now()-started>150000){errors.push('达到本次安全时长，其余商品留待下一轮');break;}
      const result=await client.functions.invoke('marketData',{action:'inventory',goods_ids:target.slice(i,i+5),refresh:true,source:action==='scheduled'?'scheduled_inventory':'manual_inventory'}).catch(e=>({data:{error:e.response?.data?.error||e.message}}));
      if(result.data.error){errors.push(result.data.error);break;}
      const payloads=result.data.items||[];
      updated+=payloads.filter(p=>p.quote_updated_this_request).length;
      reused+=payloads.filter(p=>!p.quote_updated_this_request&&!p.empty&&!p.refresh_errors?.length).length;
      const fresh=payloads.filter(p=>!p.quote_only&&p.detail_complete&&!p.stale&&!p.refresh_errors?.length&&!p.errors?.length&&Date.now()-Date.parse(p.fetched_at)<=21600000);
      if(fresh.length) {
        try {reports+=(await researchInventory(client,fresh)).length;}
        catch(e){errors.push(e.message);}
      }
      if(payloads.some(p=>p.stale||p.refresh_errors?.length||p.errors?.length)){errors.push('部分BUFF接口未成功，保留旧行情；缺失数据不生成新建议');break;}
    }
    const message=errors.join('；'),complete=updated+reused===ids.length&&!message;
    await db.MarketControl.updateMany({id:tracking.id,lease_token:token},{$set:{last_error:message||(!complete?`本轮更新${updated}/${ids.length}个商品，其余下轮继续`:''),...(complete?{last_success:new Date().toISOString()}:{})}});
    return Response.json({updated,reports,total:ids.length,reused,deferred:Math.max(0,ids.length-updated-reused),message:message||`新采集基础报价${updated}个，复用60分钟内报价${reused}个；已有走势和报告保留`,complete});
  } catch(e) {
    if(db&&tracking&&token)await db.MarketControl.updateMany({id:tracking.id,lease_token:token},{$set:{last_error:e.message||'库存追踪失败'}});
    return Response.json({error:e.message||'库存追踪失败'},{status:500});
  } finally {if(db&&tracking&&token)await db.MarketControl.updateMany({id:tracking.id,lease_token:token},{$set:{lease_until:'1970-01-01T00:00:00.000Z'}});}
}