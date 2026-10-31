import React from 'react';
import BuyConditionTags from '@/components/market/BuyConditionTags';
import { price, time } from '@/components/market/marketClient';

export default function MarketBuyList({ items }) {
  return <div>
    <p role="note" className="mb-3 rounded-xl bg-market-warning px-3 py-2.5 text-xs leading-6 text-market-warning-foreground">带「仅限磨损」或其他限定条件的求购单，只对满足全部条件的饰品有效，不能当作整款都能卖出的价格；成交前请到BUFF核对。</p>
    {!!items.length && <table className="w-full table-fixed text-left text-xs sm:text-sm">
      <caption className="sr-only">求购价格、剩余数量与限定条件</caption>
      <colgroup><col className="w-1/4"/><col className="w-1/5"/><col/></colgroup>
      <thead className="text-muted-foreground"><tr className="border-b"><th scope="col" className="py-3 pr-2 font-medium">价格</th><th scope="col" className="py-3 pr-2 font-medium">数量</th><th scope="col" className="py-3 font-medium">条件</th></tr></thead>
      <tbody>{items.map(order => <tr key={order.id} className="border-b last:border-b-0">
        <td className="break-words py-3 pr-2 align-top font-semibold tabular-nums">{price(order.price_cents)}</td>
        <td className="break-words py-3 pr-2 align-top">{order.remaining == null ? '未提供' : `${order.remaining}件`}</td>
        <td className="py-3 align-top"><BuyConditionTags conditions={order.conditions}/><details className="mt-1.5 text-xs text-muted-foreground"><summary className="min-h-6 cursor-pointer py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">订单与更新时间</summary><div className="break-all leading-6">订单 {order.id}<br/>采集 {time(order.fetched_at)}<br/>源更新时间 {order.source_updated_at || '未提供'}</div></details></td>
      </tr>)}</tbody>
    </table>}
  </div>;
}