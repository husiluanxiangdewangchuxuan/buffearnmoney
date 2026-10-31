import { readCache, saveCache } from './marketService.ts';
export const scanScopes=[{key:'knife',group:'knife',label:'刀皮'},{key:'gun_rifle',group:'gun',gun_group:'rifle',label:'枪皮·步枪'},{key:'gun_pistol',group:'gun',gun_group:'pistol',label:'枪皮·手枪'},{key:'gun_smg',group:'gun',gun_group:'smg',label:'枪皮·微冲'},{key:'gun_shotgun',group:'gun',gun_group:'shotgun',label:'枪皮·霰弹枪'},{key:'gun_machinegun',group:'gun',gun_group:'machinegun',label:'枪皮·机枪'},{key:'case',group:'case',label:'箱子'},{key:'music',group:'music',label:'音乐盒'}];
export const isRunId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export const evidenceQuery=runId=>({cache_key:{$regex:`^scan:m2:item:${runId}:`}});
export async function currentScan(db){const head=await readCache(db,'scan:m2:head');if(!head?.payload?.run_id)return null;return (await readCache(db,`scan:m2:run:${head.payload.run_id}`))?.payload||null;}
export async function scanSummary(db,runId){if(!runId)return [];return (await db.MarketCache.aggregate({query:evidenceQuery(runId),groupBy:'kind'})).rows.map(row=>{const [,group,outcome]=row.kind.split(':');return {group,outcome,count:row.count};});}
export async function acquireScan(db){
  const control=(await db.MarketControl.filter({key:'market_m2'},{limit:1})).items[0];
  if(!control)throw Object.assign(new Error('扫描配置尚未初始化'),{status:503});
  if(control.lease_until>new Date().toISOString())throw Object.assign(new Error('本轮扫描正在处理，请稍后再操作'),{status:409});
  const token=crypto.randomUUID();
  await db.MarketControl.updateMany({id:control.id,lease_token:control.lease_token,lease_until:control.lease_until},{$set:{lease_token:token,lease_until:new Date(Date.now()+240000).toISOString()}});
  if((await db.MarketControl.get(control.id)).lease_token!==token)throw Object.assign(new Error('其他窗口已启动扫描操作'),{status:409});
  return {id:control.id,token};
}
export async function assertScanLease(db,lease){const current=await db.MarketControl.get(lease.id);if(current.lease_token!==lease.token||current.lease_until<=new Date().toISOString())throw Object.assign(new Error('扫描租约已失效，本次停止写入，请重新读取进度'),{status:409});}
export async function releaseScan(db,lease){await db.MarketControl.updateMany({id:lease.id,lease_token:lease.token},{$set:{lease_until:'1970-01-01T00:00:00.000Z'}});}
export async function putScan(db,lease,state){await assertScanLease(db,lease);state.updated_at=new Date().toISOString();await saveCache(db,`scan:m2:run:${state.run_id}`,'scan_m2_run',state,{fetched_at:state.updated_at,batch_id:state.run_id});}
export async function startScan(db,lease){
  const state={run_id:crypto.randomUUID(),version:'m2.scan.1',status:'running',scope_index:0,next_page:1,pending:[],pages:[],catalog_rows:0,duplicates:0,invalid_rows:0,message:'轮次已建立，点击执行本批开始读取；不会自动连续请求BUFF。',coverage_complete:false,started_at:new Date().toISOString()};
  await putScan(db,lease,state);await assertScanLease(db,lease);
  await saveCache(db,'scan:m2:head','scan_m2_head',{run_id:state.run_id},{fetched_at:state.updated_at,batch_id:state.run_id});return state;
}