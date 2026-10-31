import { base44 } from '@/api/base44Client';
export async function scanCall(payload){const response=await base44.functions.invoke('marketScan',payload);if(response.data.error)throw new Error(response.data.error);return response.data;}
export const scanError=e=>e?.response?.data?.error||e?.message||'扫描操作失败，请重试';
export const scanStatus={running:'可继续扫描',paused:'已暂停',completed:'目录遍历结束',closed:'已手工结束，覆盖不完整'};
export const scanOutcome={eligible:'满足研究门槛，非正式推荐',observe:'观察',insufficient:'数据不足'};