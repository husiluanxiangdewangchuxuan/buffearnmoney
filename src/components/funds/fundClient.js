import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useStockUser } from '@/components/stock/useStockData';
export const cash=v=>v==null?'未设置':`¥${(v/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const amount=v=>/^\d+(\.\d{1,2})?$/.test(String(v).trim())?Math.round(Number(v)*100):null;
export const stamp=v=>v?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'尚未初始化';
export const fundError=e=>e?.response?.data?.error||e?.message||'保存失败，请刷新资金状态后重试';
export async function fundCall(payload){const {data}=await base44.functions.invoke('fundManage',payload);if(data.error)throw new Error(data.error);return data;}
export function useFunds(limit=20){const {data:user}=useStockUser();return useQuery({queryKey:['fund-book',user?.id,limit],enabled:!!user,queryFn:()=>fundCall({action:'read',history_limit:limit}),retry:false,staleTime:0});}
export function useFundMutation(book){const client=useQueryClient();return useMutation({mutationFn:payload=>fundCall({...payload,wallet_id:book?.id||null,version:book?.version??0}),onSettled:()=>client.invalidateQueries({queryKey:['fund-book']})});}