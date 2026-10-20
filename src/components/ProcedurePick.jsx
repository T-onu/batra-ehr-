import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { inr } from '../lib/supabase'
// Searchable list that opens on click. Items with a charge fill the amount automatically; others are priced manually.
export default function ProcedurePick({items,value,onChange,onPick,placeholder}){
  const [open,setOpen]=useState(false),t=(value||'').trim().toLowerCase()
  const list=(t?items.filter(c=>c.name.toLowerCase().includes(t)):items).slice(0,80)
  return <div className="relative"><input className="inp pr-9" placeholder={placeholder} value={value} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),150)} onChange={e=>{onChange(e.target.value);setOpen(true)}}/>
    <ChevronDown size={16} className="pointer-events-none absolute right-3 top-3 text-slate-400"/>
    {open&&<div className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      {list.length===0&&<p className="px-3 py-3 text-xs text-slate-400">Not in the list. You can still type the name and enter the charge manually.</p>}
      {list.map(c=><button type="button" key={c.id||c.name} onMouseDown={e=>e.preventDefault()} onClick={()=>{onPick(c);setOpen(false)}} className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="min-w-0">{c.name}</span>
        <span className={`shrink-0 text-xs font-semibold ${c.rate==null?'text-slate-300':'text-navy'}`}>{c.rate==null?'manual':inr(c.rate)}</span></button>)}</div>}</div>
}
