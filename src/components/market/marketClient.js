import { base44 } from '@/api/base44Client';
export const categories=[['knife','刀皮'],['gun','枪皮'],['case','箱子'],['music','音乐盒']];
export const price=v=>v==null?'未提供':`¥${(v/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const time=v=>v?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'未提供';
export const change=v=>v==null?'暂无可比数据':`${v>=0?'+':''}${(v*100).toFixed(2)}%（${v>0?'上涨':v<0?'下跌':'持平'}）`;
export async function marketCall(payload){const response=await base44.functions.invoke('marketData',payload);if(response.data.error)throw Object.assign(new Error(response.data.error),{data:response.data});return response.data;}
export const marketError=e=>e?.response?.data?.error||e?.message||'行情请求失败，请稍后重试';