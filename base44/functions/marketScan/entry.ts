import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { scanScopes, isRunId, evidenceQuery, currentScan, scanSummary, acquireScan, releaseScan, putScan, startScan } from '../../shared/marketScanStore.ts';
import { runScanBatch } from '../../shared/marketScanWork.ts';
export default async function(req){
  let db,lease,state,client,action,writeFailure=false;
  try{
    client=createClientFromRequest(req);const user=await client.auth.me().catch(e=>e.status===401?null:Promise.reject(e));
    if(!user)return Response.json({error:'请先登录'},{status:401});
    const body=await req.json().catch(()=>null);
    if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'扫描请求格式不正确'},{status:400});
    action=body.action||'status';
    if(!['status','results','start','step','pause','resume','finish'].includes(action))return Response.json({error:'不支持的扫描操作'},{status:400});
    if(!['status','results'].includes(action)&&user.role!=='admin')return Response.json({error:'仅管理员可启动或修改扫描轮次'},{status:403});
    if(!['status','start'].includes(action)&&!isRunId(body.run_id))return Response.json({error:'扫描轮次编号不正确'},{status:400});
    if(body.cursor!=null&&(typeof body.cursor!=='string'||body.cursor.length>2000))return Response.json({error:'分页游标不正确'},{status:400});
    db=client.asServiceRole.entities;
    if(action==='results')return Response.json(await db.MarketCache.filter(evidenceQuery(body.run_id),{sort:'-created_date',limit:20,cursor:body.cursor}));
    if(action==='status'){state=await currentScan(db);return Response.json({state,summary:await scanSummary(db,state?.run_id),scopes:scanScopes,max_batch:3});}
    lease=await acquireScan(db);state=await currentScan(db);
    if(action==='start'){
      if(state&&['running','paused'].includes(state.status))return Response.json({error:'已有未结束轮次，请续扫或先结束本轮'},{status:409});
      state=await startScan(db,lease);
    }else{
      if(!state||state.run_id!==body.run_id)return Response.json({error:'轮次已变化，请读取最新进度后操作'},{status:409});
      if(!['running','paused'].includes(state.status))return Response.json({error:'本轮已结束，不能再修改；可建立新轮次'},{status:409});
      if(action==='step'){
        if(state.status!=='running')return Response.json({error:'请先恢复断点，再执行本批'},{status:409});
        writeFailure=true;state=await runScanBatch(client,db,lease,state);
      }else{
        state.status=action==='pause'?'paused':action==='resume'?'running':'closed';
        state.message=action==='pause'?'已暂停，目录断点、待研究商品与已留存证据均保留。':action==='resume'?'已恢复断点，点击执行本批继续；不会自动请求BUFF。':'本轮已手工结束，覆盖不完整；既有证据保留，未发布正式推荐。';
        if(action==='finish'){state.coverage_complete=false;state.closed_at=new Date().toISOString();}
        await putScan(db,lease,state);
      }
    }
    return Response.json({state,summary:await scanSummary(db,state.run_id),scopes:scanScopes,max_batch:3});
  }catch(e){
    if(writeFailure&&db&&lease&&state){
      state.message=`本批已停止：${e.message}。已有证据和待处理断点保留，未成功商品没有新研究。`;
      if(/预算/.test(e.message))state.retry_at=new Date((Math.floor((Date.now()+28800000)/86400000)+1)*86400000-28800000).toISOString();
      else if(/限流/.test(e.message)){const status=await client.functions.invoke('marketData',{action:'status'}).catch(()=>({data:{}}));state.retry_at=status.data.retry_at||null;}
      await putScan(db,lease,state).catch(error=>console.error('scan_checkpoint_failed',error.message));
    }
    return Response.json({error:e.message||'扫描操作失败，请读取进度后重试'},{status:[400,401,403,404,409,429,502,503].includes(e.status)?e.status:500});
  }finally{if(db&&lease)await releaseScan(db,lease);}
}