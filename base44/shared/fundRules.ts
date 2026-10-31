export function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
export function cents(v){if(!Number.isSafeInteger(v)||v<0||v>10000000000)fail('金额必须为非负整数分，且不超过一亿元');return v;}
export function totals(b){const reserved=(b.plans||[]).reduce((s,p)=>s+(p.status==='reserved'?p.amount_cents:0),0);return {reserved_cents:reserved,available_cents:b.platform_cents+b.bank_cents-reserved,pending_cents:(b.receipts||[]).reduce((s,r)=>s+(r.status==='pending'?r.net_cents:0),0)};}
export function publicBook(b,limit=20){if(!b)return {book:null};return {book:{...b,...totals(b),journal:[...(b.journal||[])].reverse().slice(0,limit),journal_total:b.journal?.length||0,journal_limit:200}};}
export function transition(original,input,now){
 const b=structuredClone(original),before={platform_cents:b.platform_cents,bank_cents:b.bank_cents,...totals(b)};b.plans||=[];b.receipts||=[];b.journal||=[];
 const action=input.action,reason=String(input.reason||'').trim();if(reason.length>300)fail('原因最多300字');
 if(b.journal.length>=200)fail('本期账本已满200笔，已暂停写入以保护记录，请先扩展账本容量',409);
 if(action==='initialize'){if(b.initialized)fail('期初余额已启用，请用余额校准',409);b.platform_cents=cents(input.platform_cents);b.bank_cents=cents(input.bank_cents);b.initialized=true;b.initialized_at=now;}
 else {
  if(!b.initialized)fail('请先填写此刻的平台余额和银行卡小店额度');
  if(action==='adjust'){if(!reason)fail('请填写调整原因');if(input.platform_cents==null&&input.bank_cents==null)fail('至少更新一处余额');if(input.platform_cents!=null)b.platform_cents=cents(input.platform_cents);if(input.bank_cents!=null)b.bank_cents=cents(input.bank_cents);}
  else if(action==='transfer'){const amount=cents(input.amount_cents);if(!amount||amount>b.bank_cents)fail('充值金额须大于零，且不超过银行卡可用额度');b.bank_cents-=amount;b.platform_cents+=amount;}
  else if(action==='receipt'){
   const reference=String(input.reference||'').trim();if(!reference||reference.length>80)fail('请填写不超过80字的成交单号，防止重复登记');if(b.receipts.some(r=>r.reference===reference))fail('该成交单号已经登记，请使用已有回款记录',409);
   const gross=cents(input.gross_cents),fee=cents(input.fee_cents),net=cents(input.net_cents);if(!gross||fee>gross||gross-fee!==net)fail('实际净回款必须等于实际成交额减手续费');
   const status=input.included===true?'included':input.available===true?'available':'pending';const r={id:input.operation_id,reference,gross_cents:gross,fee_cents:fee,net_cents:net,status,created_at:now,available_at:status==='pending'?null:now,included:input.included===true};b.receipts.push(r);if(status==='available')b.platform_cents+=net;
  }
  else if(action==='settle'){const r=b.receipts.find(r=>r.id===input.receipt_id);if(!r)fail('找不到这笔回款',404);if(r.status!=='pending')return null;r.status='available';r.available_at=now;b.platform_cents+=r.net_cents;}
  else if(action==='reserve'){
   if(!Array.isArray(input.items)||!input.items.length||input.items.length>30)fail('请选择1至30款候选');const seen=new Set();const items=input.items.map(i=>{const id=String(i.goods_id||''),name=String(i.name||'').trim();if(!/^\d{1,12}$/.test(id)||!name||name.length>200||seen.has(id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>999)fail('候选名称、商品ID或数量不正确，重复商品请合并数量');seen.add(id);if(!cents(i.unit_cents))fail('候选价格必须大于零');return {goods_id:id,name,quantity:i.quantity,unit_cents:i.unit_cents,quote_at:String(i.quote_at||'').slice(0,40)};});
   const amount=items.reduce((s,i)=>s+i.quantity*i.unit_cents,0);if(!Number.isSafeInteger(amount)||amount>totals(b).available_cents)fail(`超预算 ¥${((amount-totals(b).available_cents)/100).toFixed(2)}，不能确认预留`,409);const name=String(input.name||'进货计划').trim();if(!name||name.length>80)fail('计划名应为1至80字');b.plans.push({id:input.operation_id,name,items,amount_cents:amount,status:'reserved',created_at:now});
  }
  else if(action==='cancel'||action==='pay'){
   const p=b.plans.find(p=>p.id===input.plan_id);if(!p)fail('找不到该进货计划',404);if(p.status===action||p.status===(action==='pay'?'paid':'cancelled'))return null;if(p.status!=='reserved')fail('计划不是待付款状态',409);
   if(action==='cancel'){p.status='cancelled';p.cancelled_at=now;}
   else {const platform=cents(input.platform_paid_cents),bank=cents(input.bank_paid_cents),amount=cents(input.amount_cents);if(!amount||platform+bank!==amount)fail('两处实付金额之和必须等于本次实际付款');if(!['platform','bank','mixed'].includes(input.payment_mode)||(input.payment_mode==='platform'&&bank!==0)||(input.payment_mode==='bank'&&platform!==0))fail('付款方式与分摊金额不一致');if(input.included!==true&&(platform>b.platform_cents||bank>b.bank_cents||amount>totals(b).available_cents+p.amount_cents))fail('资金不足，或付款会占用其他计划的预留',409);const unlock=input.unlock_at?new Date(input.unlock_at):null;if(unlock&&Number.isNaN(unlock.getTime()))fail('交易冷却结束时间不正确');if(input.included!==true){b.platform_cents-=platform;b.bank_cents-=bank;}Object.assign(p,{status:'paid',paid_at:now,actual_cents:amount,platform_paid_cents:platform,bank_paid_cents:bank,payment_mode:input.payment_mode,included:input.included===true,unlock_at:unlock?.toISOString()||null});}
  }else fail('不支持的资金操作');
 }
 if(totals(b).available_cents<0)fail('调整后余额不足以覆盖已预留计划，请先取消或缩减预留',409);
 b.version=original.version+1;b.balance_updated_at=now;b.journal.push({id:input.operation_id,action,at:now,reason:reason||(action==='initialize'?'启用此刻余额':action==='transfer'?'银行卡充值到平台':action==='receipt'?`回款 ${input.reference}`:action==='reserve'?String(input.name||'进货计划'):'手工确认'),reference:input.reference||input.plan_id||input.receipt_id||null,included:input.included===true,before,after:{platform_cents:b.platform_cents,bank_cents:b.bank_cents,...totals(b)}});return b;
}