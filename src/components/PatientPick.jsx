import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
export default function PatientPick({pt,setPt}){const [q,setQ]=useState(''),[res,setRes]=useState([])
  useEffect(()=>{if(!q.trim()){setRes([]);return};const t=setTimeout(async()=>{const {data}=await supabase.from('patients').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%,uhid.ilike.%${q}%`).limit(6);setRes(data||[])},250);return()=>clearTimeout(t)},[q])
  if(pt)return <div className="flex items-center justify-between rounded-xl bg-navy-50 p-3 text-sm"><div><b>{pt.name}</b><div className="text-xs text-slate-500">{pt.uhid} · {pt.phone}</div></div><button onClick={()=>setPt(null)}><X size={16}/></button></div>
  return <div><div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder="Patient: name / phone / UHID" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {res.map(p=><button key={p.id} onClick={()=>setPt(p)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-400">{p.uhid} · {p.phone}</span></button>)}</div>}
