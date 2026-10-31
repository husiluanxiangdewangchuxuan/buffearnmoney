import { base44 } from '@/api/base44Client';
export const stockFields={goods_id:'商品ID',name:'商品全名',quantity:'数量',unit_cost:'单件落地成本（元）',asset_id:'资产ID',account:'库存账号',paintwear:'精确磨损',style:'款式',paintseed:'模板',stattrak:'StatTrak',souvenir:'纪念品',trade_status:'可交易状态',received_at:'收货时间（北京时间）',unlock_at:'冷却结束时间（北京时间）',notes:'备注'};
export const money=value=>value==null?'待补充':new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(value/100);
export const statusNames={unknown:'待核实',protected:'交易保护中',tradable:'手工确认可交易'};
export async function callStock(name,payload){const {data}=await base44.functions.invoke(name,payload);if(data.error)throw new Error(data.error);return data;}
export function downloadCsv(name,rows){const text='\ufeff'+rows.map(row=>row.map(v=>'"'+String(/^[=+@\-\t\r\n]/.test(String(v??''))?"'"+v:(v??'')).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function downloadTemplate(){downloadCsv('库存导入模板.csv',[Object.values(stockFields)]);}
export const errorText=error=>error?.response?.data?.error||error?.message||'操作失败，请重试';