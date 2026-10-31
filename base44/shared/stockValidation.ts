export const fields = {goods_id:'商品ID',name:'商品全名',quantity:'数量',unit_cost:'单件落地成本',asset_id:'资产ID',account:'库存账号',paintwear:'精确磨损',style:'款式',paintseed:'模板',stattrak:'StatTrak',souvenir:'纪念品',trade_status:'可交易状态',received_at:'收货时间',unlock_at:'冷却结束时间',notes:'备注'};
export function cents(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const s = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('金额须为非负数字，最多两位小数');
  const [whole, decimal=''] = s.split('.');
  const n = Number(whole) * 100 + Number(decimal.padEnd(2,'0'));
  if (!Number.isSafeInteger(n) || n > 10000000000) throw new Error('金额超出首版支持范围');
  return n;
}
export function normalizeStock(raw) {
  const text = key => String(raw[key] ?? '').trim();
  const name = text('name'), goods = text('goods_id');
  if (!name || name.length > 180) throw new Error('请填写不超过180字的商品完整名称');
  if (!/^\d+$/.test(goods)) throw new Error('缺少有效商品ID，请核对后补齐，不按名称猜测');
  const quantity = text('quantity') === '' ? 1 : Number(raw.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new Error('数量必须为1至10000的整数');
  const wearState=['不适用','N/A','n/a'].includes(text('paintwear'))?'not_applicable':text('paintwear')===''?'unknown':'value';
  const wear = wearState==='value'?Number(raw.paintwear):null;
  if (wear !== null && (!Number.isFinite(wear) || wear < 0 || wear > 1)) throw new Error('精确磨损须为0至1之间数字，未知请留空');
  if ((text('asset_id') || wear !== null || text('paintseed') || text('style')) && quantity !== 1) throw new Error('有单件属性的物品请逐件导入，数量为1');
  const statusMap = {tradable:'tradable','可交易':'tradable',protected:'protected','保护中':'protected',unknown:'unknown','未知':'unknown','':'unknown'};
  if (!(text('trade_status') in statusMap)) throw new Error('可交易状态仅支持：未知、保护中、可交易');
  const flag = key => {const s=text(key).toLowerCase(); if(['yes','是','1','true'].includes(s)) return 'yes'; if(['no','否','0','false'].includes(s)) return 'no'; if(['','unknown','未知'].includes(s)) return 'unknown'; throw new Error(`${fields[key]}须为是、否或未知`);};
  let received = '';
  if (text('received_at')) { const s=text('received_at'); const local=/^\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}(:\d{2})?$/.test(s); const d=new Date(local ? s.replace(' ','T')+'+08:00' : s); if (!Number.isFinite(d.getTime())) throw new Error('收货时间格式无效，请使用带时区时间或北京时间'); received=d.toISOString(); }
  let unlock='';if(text('unlock_at')){const s=text('unlock_at'),local=/^\d{4}-\d{2}-\d{2}(T| )\d{2}:\d{2}(:\d{2})?$/.test(s),d=new Date(local?s.replace(' ','T')+'+08:00':s);if(!Number.isFinite(d.getTime()))throw new Error('交易冷却结束时间无效，请使用北京时间或带时区时间');unlock=d.toISOString();}
  const cost=cents(raw.unit_cost);
  return {name,goods_id:goods,quantity,unit_cost_cents:cost,cost_total_cents:cost===null?null:cost*quantity,unknown_quantity:cost===null?quantity:0,asset_id:text('asset_id').slice(0,100),account:text('account').slice(0,80),paintwear:wear,paintwear_state:wearState,style:text('style').slice(0,80),paintseed:text('paintseed').slice(0,80),stattrak:flag('stattrak'),souvenir:flag('souvenir'),trade_status:statusMap[text('trade_status')],received_at:received,unlock_at:unlock,status_verified_at:statusMap[text('trade_status')]==='tradable'?new Date().toISOString():'',notes:text('notes').slice(0,500),version:1};
}
export async function digest(text) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join(''); }