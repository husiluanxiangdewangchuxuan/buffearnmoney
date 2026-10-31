import { metrics } from './marketNormalize.ts';
import { scanScopes, assertScanLease, putScan } from './marketScanStore.ts';
async function marketRequest(client,args){
  const response=await client.functions.invoke('marketData',{...args,source:'manual_scan'}).catch(e=>{throw Object.assign(new Error(e.response?.data?.error||e.message||'行情读取失败'),{status:e.response?.status||502});});
  const data=response.data;
  if(data.error||data.stale||data.refresh_errors?.length)throw Object.assign(new Error(data.error||data.refresh_errors?.map(e=>e.message).join('；')||'本次只取得过期行情，保留断点，未留存新研究'),{status:409});
  return data;
}
async function catalogPage(client,db,lease,state){
  const scope=scanScopes[state.scope_index],page=state.next_page;
  if(page>2000)throw Object.assign(new Error('超过当前目录分页上限，覆盖不完整；可结束本轮，不会冒充全目录完成'),{status:409});
  const data=await marketRequest(client,{action:'catalog',group:scope.group,gun_group:scope.gun_group||'rifle',page,budget_cents:null});
  if(!Array.isArray(data.items)||data.items.length>5)throw new Error('目录响应与当前5款分页契约不符，断点未推进');
  const valid=data.items.filter(row=>/^\d{1,12}$/.test(row.goods_id)&&row.item),unique=[...new Map(valid.map(row=>[row.goods_id,row])).values()];
  const keys=unique.map(row=>`scan:m2:item:${state.run_id}:${row.goods_id}`);
  const existing=keys.length?await db.MarketCache.filter({cache_key:{$in:keys}},{limit:10}):{items:[]};
  const seen=new Set(existing.items.map(row=>row.cache_key));
  state.pending=unique.filter(row=>!seen.has(`scan:m2:item:${state.run_id}:${row.goods_id}`)).map(row=>({goods_id:row.goods_id,item:row.item,scope_key:scope.key,group:scope.group,catalog_fetched_at:data.fetched_at,catalog_batch_id:data.batch_id}));
  state.catalog_rows+=data.items.length;state.invalid_rows+=data.items.length-valid.length;state.duplicates+=valid.length-unique.length+unique.filter(row=>seen.has(`scan:m2:item:${state.run_id}:${row.goods_id}`)).length;
  let progress=state.pages.find(row=>row.scope===scope.key);
  if(!progress){progress={scope:scope.key,pages:0,total:data.total??null};state.pages.push(progress);}
  progress.pages++;progress.last_page=page;progress.last_fetched_at=data.fetched_at;progress.total=data.total??progress.total;
  const end=(Number.isFinite(data.total_pages)&&page>=data.total_pages)||(Number.isFinite(data.total)&&page*5>=data.total)||data.items.length<5;
  if(end){state.scope_index++;state.next_page=1;}else state.next_page++;
  await putScan(db,lease,state);
}
async function recordItem(client,db,lease,state,pending){
  const key=`scan:m2:item:${state.run_id}:${pending.goods_id}`;
  if((await db.MarketCache.filter({cache_key:key},{limit:1})).items.length){state.duplicates++;return false;}
  const data=await marketRequest(client,{action:'detail',goods_id:pending.goods_id});
  const age=Date.now()-Date.parse(data.fetched_at);
  if(!Number.isFinite(age)||age<0||age>=900000||String(data.goods_id)!==pending.goods_id||!Array.isArray(data.series))throw new Error('商品详情过期、身份不符或证据格式不完整，未推进该商品');
  const research=metrics(data.series,Date.parse(data.fetched_at));
  if(data.errors?.length){research.score=null;research.parts=null;research.status='观察';research.risks.push('部分接口未成功，不满足完整研究门槛');}
  const outcome=Number.isFinite(research.score)&&research.status==='研究优选'&&!research.risks.length?'eligible':research.days7>=6?'observe':'insufficient';
  const {settings,capabilities,cached,...evidence}=data;
  evidence.item={...data.item,name:!data.item?.name||/^商品 #/.test(data.item.name)?pending.item.name:data.item.name,market_hash_name:data.item?.market_hash_name||pending.item.market_hash_name,image:data.item?.image||pending.item.image};
  const payload={...evidence,research,run_id:state.run_id,group:pending.group,scope_key:pending.scope_key,outcome,catalog_fetched_at:pending.catalog_fetched_at,catalog_batch_id:pending.catalog_batch_id};
  await assertScanLease(db,lease);
  await db.MarketCache.create({cache_key:key,kind:`scan_m2_item:${pending.group}:${outcome}`,goods_id:pending.goods_id,fetched_at:data.fetched_at,batch_id:state.run_id,payload});
  return true;
}
export async function runScanBatch(client,db,lease,state){
  let catalogRead=false,handled=0,created=0;const started=Date.now();state.retry_at=null;
  while(handled<3&&Date.now()-started<90000){
    if(!state.pending.length){if(state.scope_index>=scanScopes.length||catalogRead)break;await catalogPage(client,db,lease,state);catalogRead=true;if(!state.pending.length)break;}
    if(await recordItem(client,db,lease,state,state.pending[0]))created++;
    state.pending.shift();handled++;await putScan(db,lease,state);
  }
  if(state.scope_index>=scanScopes.length&&!state.pending.length){state.status='completed';state.coverage_complete=true;state.completed_at=new Date().toISOString();state.message='本轮目录遍历结束；这是动态目录去重结果，不是同一时刻全市场快照，尚未发布正式推荐。';}
  else state.message=`本批处理${handled}款，新增留存${created}份证据；断点已保存，点击执行本批继续。未读取商品不纳入候选。`;
  await putScan(db,lease,state);return state;
}