export default function quoteChartData(sellLine,buyLine) {
  const rows=new Map(),lines=[];
  const day=time=>Math.floor((time+8*3600000)/86400000);
  for(const [kind,line,name,color] of [
    ['sell',sellLine,'最低在售','hsl(var(--primary))'],
    ['buy',buyLine,'商品级求购参考','hsl(var(--muted-foreground))'],
  ]) {
    let previous=null,segment=-1,key;
    for(const point of [...(line?.points||[])].sort((a,b)=>a.time-b.time)) {
      if(previous===null||day(point.time)-day(previous)>1) {
        key=`${kind}_${++segment}`;
        lines.push({key,kind,name,color});
      }
      const row=rows.get(point.time)||{time:point.time};
      row[key]=point.value_cents;
      rows.set(point.time,row);
      previous=point.time;
    }
  }
  return {rows:[...rows.values()].sort((a,b)=>a.time-b.time),lines};
}