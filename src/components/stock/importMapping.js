import { stockFields } from '@/components/stock/stockClient';

const aliases = {
  name: ['完整商品名称', '商品完整名称', '商品名称'],
  unit_cost: ['进货单价', '采购单价', '进货单价（元）', '采购单价（元）'],
  paintwear: ['实际磨损', '磨损值'],
  paintseed: ['模板编号'],
  unlock_at: ['可交易时间', '交易冷却结束时间', '冷却结束时间'],
};
const normalize = value => String(value).normalize('NFKC').replace(/[\s\uFEFF]/g, '').toLowerCase();
export default function importMapping(headers) {
  return Object.fromEntries(Object.entries(stockFields).map(([key, label]) => {
    const names = [key, label, label.replace(/（.*）/, ''), ...(aliases[key] || [])].map(normalize);
    const matches = headers.filter(header => names.includes(normalize(header)));
    return [key, matches.length === 1 ? matches[0] : ''];
  }));
}