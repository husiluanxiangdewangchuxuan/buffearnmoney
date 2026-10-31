import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { fail,publicBook,transition } from '../../shared/fundRules.ts';
export default async function(req){
 try {
  const client=createClientFromRequest(req),user=await client.auth.me().catch(e=>e.status===401?null:Promise.reject(e));if(!user)return Response.json({error:'请先登录'},{status:401});
  const raw=await req.text();if(raw.length>24000)return Response.json({error:'资金操作内容过长'},{status:400});let input;try{input=JSON.parse(raw);}catch{return Response.json({error:'请求格式不正确'},{status:400});}
  if(!input||typeof input!=='object'||!['read','initialize','adjust','transfer','receipt','settle','reserve','cancel','pay'].includes(input.action))return Response.json({error:'不支持的资金操作'},{status:400});
  const limit=input.history_limit??20;if(!Number.isInteger(limit)||limit<1||limit>200)return Response.json({error:'历史记录页数不正确'},{status:400});
  const db=client.asServiceRole.entities;let records=await db.FundBook.filter({owner_id:user.id},{sort:'created_date',limit:1}),book=records.items[0];
  if(input.action==='read')return Response.json(publicBook(book,limit));
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.operation_id||''))return Response.json({error:'缺少有效操作编号，请重新打开表单'},{status:400});
  if(!book&&input.action==='initialize'){await db.FundBook.create({owner_id:user.id,version:0,initialized:false,platform_cents:0,bank_cents:0,plans:[],receipts:[],journal:[]});records=await db.FundBook.filter({owner_id:user.id},{sort:'created_date',limit:1});book=records.items[0];}
  if(!book)fail('请先启用资金池',409);
  const {version,wallet_id,...stable}=input,bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable))),hash=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');
  const prior=book.journal.find(e=>e.id===input.operation_id);if(prior){if(prior.hash!==hash)fail('同一操作编号不能修改内容，请重新打开表单',409);return Response.json({...publicBook(book),replayed:true});}
  if((wallet_id&&wallet_id!==book.id)||(!wallet_id&&input.action!=='initialize')||version!==book.version)fail('资金已被其他窗口更新，请查看最新金额后重新提交',409);
  const next=transition(book,input,new Date().toISOString());if(!next)return Response.json({...publicBook(book),already_completed:true});next.journal[next.journal.length-1].hash=hash;
  const {id,created_date,updated_date,created_by_id,created_by,...fields}=next;
  const result=await db.FundBook.updateMany({id:book.id,owner_id:user.id,version:book.version},{$set:fields});if(result.updated!==1)fail('其他窗口刚刚更新资金，已阻止重复记账，请刷新后重新提交',409);
  return Response.json(publicBook({...next,id:book.id}));
 }catch(e){return Response.json({error:e.status&&e.status<500?e.message:'资金保存失败，请先刷新核对余额，不要重复登记'},{status:e.status&&e.status<500?e.status:500});}
}