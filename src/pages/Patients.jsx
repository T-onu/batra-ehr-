import { useEffect, useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Receipt from '../components/Receipt'
import OpdRegister from '../components/OpdRegister'
import PatientProfile from './PatientProfile'
export default function Patients({profile}){
  const canReg=['Reception','Admin','Super Admin'].includes(profile?.role)
  const [q,setQ]=useState(''),[list,setList]=useState([]),[open,setOpen]=useState(false),[msg,setMsg]=useState(''),[rcpt,setRcpt]=useState(null),[viewId,setViewId]=useState(null)
  const load=async()=>{let r=supabase.from('patients').select('*').order('created_at',{ascending:false}).limit(50)
    if(q.trim())r=r.or(`name.ilike.%${q}%,phone.ilike.%${q}%,uhid.ilike.%${q}%,legacy_uhid.ilike.%${q}%`);const {data}=await r;setList(data||[])}
  useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[q])
  const done=async r=>{const {data:b}=await supabase.from('bills').select('*, patients(name,uhid), visits(visit_no)').eq('id',r.bill_id).single()
    setOpen(false);setMsg(`Registered ✓  UHID ${r.uhid} · ${r.visit_no} · Fee ₹${r.fee}`);setRcpt(b);load()}
  if(viewId)return <PatientProfile id={viewId} profile={profile} onBack={()=>{setViewId(null);load()}}/>
  return <div className="space-y-4">
    <div className="flex gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder="Search by name, phone or UHID…" value={q} onChange={e=>setQ(e.target.value)}/></div>
      {canReg&&<button className="btn" onClick={()=>setOpen(true)}><Plus size={16}/>New</button>}</div>
    {msg&&<p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{msg}</p>}
    <div className="card divide-y divide-slate-100">{list.length===0&&<p className="p-10 text-center text-sm text-slate-400">No patients found.</p>}
      {list.map(p=><div key={p.id} onClick={()=>setViewId(p.id)} className="flex cursor-pointer items-center gap-3 px-4 py-3.5 hover:bg-slate-50 sm:px-5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy-50 text-sm font-bold text-navy">{p.name[0]}</div>
        <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="truncate text-xs text-slate-400">{p.age&&p.age+'y · '}{p.sex} · {p.phone}</div></div>
        <span className="rounded-lg bg-navy-50 px-2 py-1 text-xs font-bold text-navy">{p.uhid}</span></div>)}</div>
    {open&&<OpdRegister onClose={()=>setOpen(false)} onDone={done}/>}
    {rcpt&&<Receipt b={rcpt} onClose={()=>setRcpt(null)}/>}</div>
}
