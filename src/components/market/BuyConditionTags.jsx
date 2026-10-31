import React from 'react';

function conditionLabel(condition) {
  if (typeof condition === 'string') return condition.trim() || '限定条件待核对';
  if (!condition || typeof condition !== 'object') return '限定条件待核对';
  if (condition.type === 'paintwear') {
    const values = condition.values;
    if (Array.isArray(values) && values.length === 2 && values.every(v => (typeof v === 'string' || typeof v === 'number') && String(v).trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 1) && Number(values[0]) <= Number(values[1])) {
      return `仅限磨损：${values[0]}–${values[1]}`;
    }
    const text = [condition.text, condition.simple_text].find(v => typeof v === 'string' && v.trim());
    return text ? `仅限磨损：${text.replace(/^磨损\s*[:：]?\s*/, '')}` : '磨损限定待核对';
  }
  const text = [condition.text, condition.simple_text].find(v => typeof v === 'string' && v.trim());
  return text || '其他限定条件，请到BUFF核对';
}

export default function BuyConditionTags({ conditions }) {
  if (conditions == null) return <span className="text-muted-foreground">条件未提供，需核对</span>;
  if (Array.isArray(conditions) && !conditions.length) return <span className="text-muted-foreground">未返回限定，仍需核对</span>;
  const entries = Array.isArray(conditions) ? conditions : [conditions];
  return <div className="flex flex-wrap gap-1.5">{entries.map((condition, index) => <span key={index} className="inline-block max-w-full break-words rounded-full bg-market-warning px-2.5 py-1 text-xs leading-5 text-market-warning-foreground">{conditionLabel(condition)}</span>)}</div>;
}