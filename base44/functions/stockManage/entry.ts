import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { normalizeStock, digest } from '../../shared/stockValidation.ts';
import { batchStockStatus } from '../../shared/stockBatch.ts';
export default async function(req) {
  try {
    const client=createClientFromRequest(req);
    const user=await client.auth.me().catch(e=>e.status===401?null:Promise.reject(e));
    if(!user) return Response.json({error:'请先登录'},{status:401});
    const body=await req.json().catch(()=>({}));
    if(!['create','update','batch_status'].includes(body.action)) return Response.json({error:'不支持的库存操作'},{status:400});
    if(typeof body.operation_id!=='string'||!(/^[a-zA-Z0-9-]{16,80}$/.test(body.operation_id))) return Response.json({error:'缺少有效操作编号'},{status:400});
    if(body.action==='batch_status')return await batchStockStatus(client.asServiceRole.entities,user,body);
    let value;
    try { value=normalizeStock(body.item||{}); } catch(e) {return Response.json({error:e.message},{status:400});}
    const {status_verified_at,...stable}=value;
    const requestHash=await digest(JSON.stringify(stable));
    const db=client.asServiceRole.entities;
    if(body.action==='create') {
      const existing=await db.StockItem.filter({owner_id:user.id,source_key:body.operation_id},{limit:1});
      if(existing.items.length) {
        if(existing.items[0].request_hash!==requestHash)return Response.json({error:'同一操作编号的内容发生变化，请重新打开补录窗口'},{status:409});
        return Response.json({item:existing.items[0],replayed:true});
      }
      if(value.asset_id) {const p=await db.StockItem.filter({owner_id:user.id,asset_id:value.asset_id,account:value.account},{limit:1});if(p.items.length)return Response.json({error:'该账号资产ID已经存在，请编辑原库存'},{status:409});}
      const item=await db.StockItem.create({...value,owner_id:user.id,source_key:body.operation_id,request_hash:requestHash,inventory_item_id:crypto.randomUUID(),batch_id:'manual'});
      await db.StockAudit.create({owner_id:user.id,actor_id:user.id,item_id:item.id,operation_id:body.operation_id,action:'manual_inventory',after:value});
      return Response.json({item});
    }
    const original=await db.StockItem.get(body.id).catch(e=>e.status===404?null:Promise.reject(e));
    if(!original||original.owner_id!==user.id) return Response.json({error:'找不到该账号的库存'},{status:404});
    if(original.last_operation_id===body.operation_id){
      if(original.last_operation_hash!==requestHash)return Response.json({error:'同一操作编号不能提交不同内容'},{status:409});
      return Response.json({item:original,replayed:true});
    }
    if(original.version!==body.version) return Response.json({error:'库存已被更新，请关闭后重新打开'},{status:409});
    if(value.quantity!==original.quantity || value.goods_id!==original.goods_id || value.asset_id!==original.asset_id || value.account!==original.account) return Response.json({error:'首批只支持补成本、属性和状态；数量及身份调整将在盘点流程提供'},{status:400});
    const changed=await db.StockItem.updateMany({id:original.id,owner_id:user.id,version:body.version},{$set:{...value,version:body.version+1,last_operation_id:body.operation_id,last_operation_hash:requestHash}});
    if(changed.updated!==1) return Response.json({error:'其他窗口已更新，请刷新重试'},{status:409});
    await db.StockAudit.create({owner_id:user.id,actor_id:user.id,item_id:original.id,operation_id:body.operation_id,action:'inventory_correction',before:original,after:value});
    return Response.json({item:await db.StockItem.get(original.id)});
  } catch(e) {
    console.error('stockManage failed',e?.status||'internal');
    return Response.json({error:'库存保存失败，请刷新确认最新状态后再操作'},{status:500});
  }
}