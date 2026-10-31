const numberKeys={req_remaining:'remaining',remaining_requests:'remaining',rate_limit_remaining:'remaining',req_limit:'limit',rate_limit_limit:'limit'};
const textKeys={req_reset:'reset',req_reset_at:'reset',rate_limit_reset:'reset',reset_at:'reset',retry_after:'retry_after'};
export function quotaFields(value){
  const result={quota_fields:{}};
  function visit(node,path,depth){
    if(!node||typeof node!=='object'||Array.isArray(node)||depth>3)return;
    for(const [key,target] of Object.entries(numberKeys))if(node[key]!=null&&typeof node[key]!=='boolean'&&String(node[key]).trim()!==''&&Number.isFinite(Number(node[key]))&&Number(node[key])>=0){result.quota_fields[`${path}.${key}`]=Number(node[key]);if(result[target]==null)result[target]=Number(node[key]);}
    for(const [key,target] of Object.entries(textKeys))if(['string','number'].includes(typeof node[key])){result.quota_fields[`${path}.${key}`]=String(node[key]).slice(0,120);if(result[target]==null)result[target]=String(node[key]).slice(0,120);}
    for(const key of ['data','meta','quota','usage','rate_limit','result','structuredContent'])visit(node[key],`${path}.${key}`,depth+1);
  }
  visit(value,'body',0);return result;
}
export function quotaHeaders(headers){
  const result={quota_fields:{}};
  for(const [key,target] of [['x-ratelimit-remaining','remaining'],['ratelimit-remaining','remaining'],['x-ratelimit-limit','limit'],['ratelimit-limit','limit'],['x-ratelimit-reset','reset'],['ratelimit-reset','reset'],['retry-after','retry_after']]){
    const value=headers.get(key);if(value==null||!value.trim())continue;
    if(['remaining','limit'].includes(target)){if(!Number.isFinite(Number(value))||Number(value)<0)continue;result[target]=Number(value);}else result[target]=value.slice(0,120);
    result.quota_fields[`header.${key}`]=result[target];
  }
  return result;
}