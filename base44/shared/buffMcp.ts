import { secrets } from 'base44:runtime';
import { quotaFields, quotaHeaders } from './marketQuota.ts';
import { redact } from './marketEvidence.ts';
export async function openBuff(onCall,hooks={}) {
  const apiKey=secrets.get('BUFF_API_KEY');
  const headers={Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'};
  let id=0,stopped=null,queue=Promise.resolve(),lastToolAt=0,lastContext=null;
  const clean=value=>redact(apiKey?String(value??'').split(apiKey).join('[已脱敏]'):value);
  const limitLike=value=>/Too Many Requests|rate[ _-]?limit|限流|请求过多|请求频繁|访问过于频繁|\bHTTP\s*429\b|\bstatus(?:code)?\s*[:=]?\s*429\b/i.test(String(value||''));
  function errorFor(context,message,{limited=false,code=null,retry=null,retrySource=null,status=502}={}) {
    const evidence={...context,business_code:code,business_message:clean(message),limited,retry_after:retry,retry_after_source:retrySource};
    hooks.observe?.(evidence);
    const error=Object.assign(new Error(limited?'BUFF明确返回限流，暂停采集；不会据此推断每日额度耗尽':status===401||status===403?'BUFF鉴权失败，请检查接入权限':'BUFF业务请求失败，保留已有行情'),{status:limited?429:status,code:limited?'BUFF_RATE_LIMIT':'BUFF_UPSTREAM_ERROR',retryAfter:retry,retryAfterSource:retrySource,httpStatus:context.http_status??null,businessCode:code,businessMessage:clean(message),tool:context.tool||null,method:context.method,goodsId:context.goods_id||null});
    if(limited||status===401||status===403)stopped=error;
    return error;
  }
  async function rpc(method,params,notification=false) {
    if(stopped)throw stopped;
    hooks.beforeRpc?.();
    const requestId=++id,event={request_id:requestId,method,tool:params?.name||null,goods_id:params?.arguments?.goods_id?String(params.arguments.goods_id):null,at:Date.now()};
    const pending=fetch('https://buff.163.com/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',...(!notification?{id:requestId}:{}),method,params}),signal:AbortSignal.timeout(12000)});
    onCall(event);
    let response;
    try {response=await pending;}catch(error){hooks.observe?.({...event,transport_error:clean(error.message),http_status:null});throw error;}
    const context={...event,http_status:response.status,received_at:new Date().toISOString(),...quotaHeaders(response.headers)};
    lastContext=context;hooks.observe?.(context);
    const session=response.headers.get('mcp-session-id');if(session)headers['Mcp-Session-Id']=session;
    const retry=response.headers.get('retry-after');
    if(!response.ok){const text=await response.text();throw errorFor(context,text||response.statusText,{limited:response.status===429,code:response.status,retry,retrySource:retry!=null?'header':null,status:response.status});}
    if(notification)return null;
    const text=await response.text();let json;
    try {
      if(text.trim().startsWith('{'))json=JSON.parse(text);
      else {const events=text.split(/\r?\n\r?\n/).map(event=>event.split(/\r?\n/).filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n')).filter(Boolean);json=events.map(x=>JSON.parse(x)).find(x=>x.id===requestId);}
    }catch {throw errorFor(context,text||'无法解析MCP响应');}
    hooks.observe?.({...context,...quotaFields(json)});
    if(!json||json.error){const issue=json?.error;throw errorFor(context,issue?.message||'MCP协议响应无效',{limited:Number(issue?.code)===429||limitLike(issue?.message),code:issue?.code??null,retry:retry??issue?.data?.retry_after??null,retrySource:retry!=null?'header':issue?.data?.retry_after!=null?'body':null});}
    return json.result;
  }
  const init=await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'buff-stock-market',version:'m1.2'}});
  if(!init?.protocolVersion)throw new Error('BUFF协议协商失败');
  headers['MCP-Protocol-Version']=init.protocolVersion;
  await rpc('notifications/initialized',{},true);
  const tools=await rpc('tools/list',{});
  async function execute(name,args) {
    if(stopped)throw stopped;
    const pause=1500-(Date.now()-lastToolAt);if(pause>0)await new Promise(resolve=>setTimeout(resolve,pause));lastToolAt=Date.now();
    const tool=tools.tools?.find(tool=>tool.name===name);
    if(!tool||!['buff_get_market_goods','buff_get_sell_order','buff_get_buy_order','buff_get_price_history'].includes(name))throw new Error('BUFF当前未提供所需只读工具');
    for(const key of Object.keys(args))if(!tool.inputSchema?.properties?.[key])throw new Error('BUFF参数契约已变化');
    hooks.beforeTool?.(name);
    const result=await rpc('tools/call',{name,arguments:args}),context=lastContext;
    let value=result?.structuredContent??result?.content?.find(x=>x.type==='text')?.text;
    for(let i=0;i<6;i++) {
      if(typeof value==='string') {
        try {value=JSON.parse(value);}catch {throw errorFor(context,value,{limited:limitLike(value)||(result?.isError&&value.trim()==='429'),retry:context.retry_after??null,retrySource:context.retry_after!=null?'header':null});}
      }else if(value&&typeof value.result==='string')value=value.result;else break;
    }
    hooks.observe?.({...context,...quotaFields(value)});
    if(result?.isError||value?.code!=='OK'||!value?.data) {
      const message=String(value?.error?.message||value?.error||value?.msg||value?.message||value||''),code=value?.code??value?.error?.status??(result?.isError&&value===429?429:null);
      const bodyRetry=value?.retry_after??value?.data?.retry_after??null,retry=context.retry_after??bodyRetry;
      throw errorFor(context,message,{limited:Number(code)===429||limitLike(message),code,retry,retrySource:context.retry_after!=null?'header':bodyRetry!=null?'body':null,status:/401|403|请先登录|Unauthorized|Forbidden/i.test(message)?403:502});
    }
    return value.data;
  }
  return {version:init.protocolVersion,tools:tools.tools,get stopped(){return stopped;},call(name,args){const job=queue.then(()=>execute(name,args));queue=job.catch(()=>{});return job;}};
}