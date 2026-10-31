import { digest } from './stockValidation.ts';
export async function batchStockStatus(db,user,body) {
  const selection=body.selection,status=body.trade_status;
  if(!Array.isArray(selection)||!selection.length||selection.length>50||!['unknown','protected','tradable'].includes(status)||body.confirmed!==true||selection.some(x=>typeof x.id!=='string'||!Number.isInteger(x.version))||new Set(selection.map(x=>x.id)).size!==selection.length)return Response.json({error:'请选择1至50条库存，并确认已在平台核实状态'},{status:400});
  const {items}=await db.StockItem.filter({owner_id:user.id,id:{$in:selection.map(x=>x.id)}},{limit:50});
  if(items.length!==selection.length)return Response.json({error:'部分库存不存在或不属于当前账号，请刷新'},{status:404});
  const hash=await digest(JSON.stringify({status})), results=[], now=new Date().toISOString();
  for(let i=0;i<items.length;i+=6)results.push(...await Promise.all(items.slice(i,i+6).map(async original=>{
    const expected=selection.find(x=>x.id===original.id),after={trade_status:status,status_verified_at:status==='unknown'?'':now,version:original.version+1,last_operation_id:body.operation_id,last_operation_hash:hash};
    if(original.last_operation_id===body.operation_id)return {id:original.id,name:original.name,success:original.last_operation_hash===hash,replayed:true};
    if(original.version!==expected.version)return {id:original.id,name:original.name,success:false,reason:'已被其他窗口更新'};
    const changed=await db.StockItem.updateMany({id:original.id,owner_id:user.id,version:expected.version},{$set:after});
    if(changed.updated!==1)return {id:original.id,name:original.name,success:false,reason:'版本冲突，请刷新'};
    await db.StockAudit.create({owner_id:user.id,actor_id:user.id,item_id:original.id,operation_id:body.operation_id,action:'batch_status_confirmation',before:{trade_status:original.trade_status,status_verified_at:original.status_verified_at,version:original.version},after});
    return {id:original.id,name:original.name,success:true};
  })));
  return Response.json({results,updated:results.filter(x=>x.success).length});
}