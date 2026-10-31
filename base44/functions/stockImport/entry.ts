import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import * as XLSX from 'npm:xlsx@0.18.5';
import { normalizeStock, fields, digest } from '../../shared/stockValidation.ts';
export default async function(req) {
  let service, activeBatch;
  try {
    const client=createClientFromRequest(req);
    const user=await client.auth.me().catch(e=>e.status===401?null:Promise.reject(e));
    if(!user) return Response.json({error:'请先登录'},{status:401});
    service=client.asServiceRole.entities;
    const body=await req.json().catch(()=>({}));
    if(body.action==='commit') {
      const batch=await service.StockImport.get(body.batch_id).catch(e=>e.status===404?null:Promise.reject(e));
      if(!batch || batch.owner_id!==user.id) return Response.json({error:'找不到该账号的导入批次'},{status:404});
      if(batch.status==='committed') return Response.json({batch,replayed:true});
      if(!['preview','recovery_required'].includes(batch.status)) return Response.json({error:'此批次正在入库，请稍后刷新。若持续处理中，请勿重复提交。'},{status:409});
      const lock=await service.StockImport.updateMany({id:batch.id,owner_id:user.id,status:batch.status},{$set:{status:'applying'}});
      if(lock.updated!==1) return Response.json({error:'批次状态已变化，请重新打开预览'},{status:409});
      activeBatch=batch.id;
      const rows=await service.StockImportRow.filter({batch_id:batch.id,owner_id:user.id},{limit:200,sort:'row_number'});
      if(rows.items.length!==batch.row_count){
        await service.StockImport.update(batch.id,{status:'recovery_required'});activeBatch=null;
        return Response.json({error:'预览记录不完整，已停止入库并标记待修复。不会提交不完整批次。'},{status:409});
      }
      const existing=await service.StockItem.filter({batch_id:batch.id,owner_id:user.id},{limit:200});
      const done=new Set(existing.items.map(i=>i.source_key));
      const candidates=rows.items.filter(r=>['valid','committed'].includes(r.status));
      const assets=candidates.map(r=>r.item.asset_id).filter(Boolean);
      const currentAssets=assets.length?await service.StockItem.filter({owner_id:user.id,asset_id:{$in:assets}},{limit:200}):{items:[]};
      const assetKeys=new Set(currentAssets.items.map(i=>`${i.account}:${i.asset_id}`));
      const additions=[],updates=[];
      for(const row of candidates) {
        const key=`${batch.fingerprint}:${row.row_number}`;
        if(done.has(key)){updates.push({id:row.id,status:'committed'});continue;}
        const item={...row.item,owner_id:user.id,batch_id:batch.id,source_key:key,inventory_item_id:crypto.randomUUID()};
        if(item.asset_id&&assetKeys.has(`${item.account}:${item.asset_id}`)){updates.push({id:row.id,status:'ignored',reason:'该账号的资产ID已经入库，已忽略；需更新请进入库存核对'});continue;}
        additions.push(item); updates.push({id:row.id,status:'committed'});
        if(item.asset_id)assetKeys.add(`${item.account}:${item.asset_id}`);
      }
      if(additions.length)await service.StockItem.bulkCreate(additions);
      if(updates.length)await service.StockImportRow.bulkUpdate(updates);
      const committed=existing.items.length+additions.length;
      await service.StockAudit.create({owner_id:user.id,actor_id:user.id,operation_id:batch.id,action:'inventory_import',after:{committed_count:committed,fingerprint:batch.fingerprint}});
      const result=await service.StockImport.update(batch.id,{status:'committed',committed_count:committed});
      activeBatch=null;
      return Response.json({batch:result});
    }
    if(!['inspect','preview'].includes(body.action)) return Response.json({error:'不支持的导入操作'},{status:400});
    if(typeof body.content!=='string'||body.content.length>1400000||!body.filename||!(/\.(xlsx|csv)$/i.test(body.filename))) return Response.json({error:'请选择不超过1MB的UTF-8 CSV或XLSX文件'},{status:400});
    const isCsv=/\.csv$/i.test(body.filename);
    let workbook;
    if(isCsv){
      let decoded;
      try {decoded=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(body.content),c=>c.charCodeAt(0)));} catch {return Response.json({error:'CSV必须为UTF-8编码，请从Excel另存为CSV UTF-8后重传'},{status:400});}
      workbook=XLSX.read(decoded,{type:'string',raw:true});
    } else workbook=XLSX.read(body.content,{type:'base64',raw:true,cellDates:false});
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    const range=XLSX.utils.decode_range(sheet['!ref']||'A1');
    if(range.e.r>200 || range.e.c>29) return Response.json({error:'首版每批最多200行、30列；请拆分文件，不会截断导入'},{status:400});
    const table=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:true});
    const headers=(table.shift()||[]).map(String);
    if(!headers.length||new Set(headers).size!==headers.length||headers.some(h=>!h.trim())) return Response.json({error:'请使用非空且不重复的列标题'},{status:400});
    const sourceRows=table.map((line,index)=>({line,row_number:index+2})).filter(({line})=>line.some(value=>String(value??'').trim()!==''));
    if(!sourceRows.length) return Response.json({error:'文件没有库存行'},{status:400});
    if(body.action==='inspect') return Response.json({headers,sample:sourceRows.slice(0,3).map(row=>row.line),row_count:sourceRows.length,sheet_name:workbook.SheetNames[0],fields});
    const mapping=body.mapping||{};
    if(!headers.includes(mapping.name)||!headers.includes(mapping.goods_id)) return Response.json({error:'请映射商品全名与商品ID'},{status:400});
    const fingerprint=await digest(body.content);
    const previous=await service.StockImport.filter({owner_id:user.id,fingerprint},{limit:1});
    if(previous.items.length) return Response.json({batch:previous.items[0],duplicate:true});
    const seenAssets=new Set(); let units=0,unknown=0,total=0,valid=0;
    const rows=sourceRows.map(({line,row_number})=>{
      const raw=Object.fromEntries(Object.keys(fields).map(key=>[key,line[headers.indexOf(mapping[key])]??'']));
      try {
        const item=normalizeStock(raw),asset=`${item.account}:${item.asset_id}`;
        if(item.asset_id&&seenAssets.has(asset)) return {row_number,status:'invalid',reason:'同文件内资产ID重复',item:raw};
        if(item.asset_id) seenAssets.add(asset);
        valid++; units+=item.quantity;
        if(item.unit_cost_cents===null) unknown+=item.quantity; else total+=item.unit_cost_cents*item.quantity;
        return {row_number,status:'valid',reason:item.asset_id?'':'无资产ID，仅按文件指纹和原始行去重；跨文件疑似重复请核对',item};
      } catch(e) {return {row_number,status:'invalid',reason:e.message,item:raw};}
    });
    const batch=await service.StockImport.create({owner_id:user.id,fingerprint,filename:String(body.filename).slice(0,150),file_uri:typeof body.file_uri==='string'?body.file_uri:'',status:'preview',row_count:rows.length,valid_count:valid,invalid_count:rows.length-valid,units,known_cost_cents:total,unknown_units:unknown,committed_count:0,mapping});
    await service.StockImportRow.bulkCreate(rows.map(r=>({...r,owner_id:user.id,batch_id:batch.id})));
    return Response.json({batch});
  } catch(e) {
    if(activeBatch&&service) await service.StockImport.update(activeBatch,{status:'recovery_required'}).catch(()=>{});
    console.error('stockImport failed',e?.status||'internal');
    return Response.json({error:activeBatch?'导入中断，批次已标记待恢复。重新打开原文件可查看已入库行并继续。':'文件处理失败，请检查文件格式后重试'},{status:500});
  }
}