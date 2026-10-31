import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export default function MoneyField({label,value,onChange,disabled=false,required=true}) {return <label className="block space-y-2"><Label asChild><span className="text-xs">{label}（元）</span></Label><Input inputMode="decimal" type="text" pattern="[0-9]+(\.[0-9]{1,2})?" maxLength={12} placeholder="0.00" required={required} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)} className="min-h-11"/></label>;}