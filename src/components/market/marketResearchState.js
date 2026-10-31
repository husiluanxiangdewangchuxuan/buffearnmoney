export default function marketResearchState(data) {
  const r=data.research||{};
  const catalog=data.tool==='buff_get_market_goods'||!!data.quote_scope;
  const unloaded=catalog&&!data.series?.some(line=>line.points?.length);
  const expired=unloaded&&(r.risks||[]).some(text=>text.includes('缓存已过期'));
  return {
    unloaded,
    label:unloaded?(expired?'详情研究已过期':'待加载走势'):r.status||'数据不足',
    score:unloaded?'历史走势待加载，暂不评分':r.score!=null?`${r.score.toFixed(1)} 分`:r.status==='观察'?'研究校验未通过，暂不评分':'历史样本不足，暂不评分',
    explanation:unloaded?(expired?'历史走势持续保留；查看原采集时间，按商品60分钟窗口手动更新后再核验评分。':'当前仅有目录报价，尚未加载该商品的7/30日走势和订单，不代表商品没有历史行情。打开详情仅读已保存的数据；走势、在售明细、求购明细分别手动更新，不随打开页面自动请求。'):null,
  };
}