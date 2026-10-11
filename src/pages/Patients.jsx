import { useEffect, useState } from 'react'
import { Search, Plus, X } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
const blank={name:'',age:'',sex:'Male',phone:'',address:'',consultant:'',fee:'',discount:'0',paid:'',mode:'Cash',kind:'OPD'}
export default function Patients(){
  const [q,setQ]=useState(''),[list,setList]=useState([]),[open,setOpen]=useState(false),[f,setF]=useState(blank),[busy,setBusy]=useState(false),[msg,setMsg]=useState('')
  const load=async()=>{let r=supabase.from('patients').select('*').order('created_at',{ascending:false}).limit(50)
    if(q.trim())r=r.or(`name.ilike.%${q}%,phone.ilike.%${q}%,uhid.ilike.%${q}%`); const {data}=await r; setList(data||[])}
  useEffect(()=>{const t=setTimeout(load,250);return()=>clearTimeout(t)},[q])
  const set=k=>e=>setF({...f,[k]:e.target.value})
  const save=async e=>{e.preventDefault();setBusy(true);setMsg('')
    const {data:p,error}=await supabase.from('patients').insert({name:f.name,age:f.age||null,sex:f.sex,phone:f.phone,address:f.address}).select().single()
    if(error){setMsg(error.message);setBusy(false);return}
    const {data:v,error:e2}=await supabase.from('visits').insert({patient_id:p.id,kind:f.kind,consultant:f.consultant,fee:f.fee||0,discount:f.discount||0,paid:f.paid||0,mode:f.mode}).select().single()
    setBusy(false); if(e2){setMsg(e2.message);return}
    setMsg(`Registered ✓  UHID ${p.uhid} · ${v.visit_no}`); setF(blank); setOpen(false); load()}
  const F=({k,label,type='text',req,children})=><div><label className="lbl">{label}</label>{children||<input className="inp" type={type} required={req} value={f[k]} onChange={set(k)}/>}</div>
  return <div className="space-y-4">
    <div className="flex gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/>
      <input className="inp pl-10" placeholder="Name, phone ya UHID search…" value={q} onChange={e=>setQ(e.target.value)}/></div>
      <button className="btn" onClick={()=>setOpen(true)}><Plus size={16}/>New</button></div>
    {msg&&<p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{msg}</p>}
    <div className="card divide-y divide-slate-100">{list.length===0&&<p className="p-10 text-center text-sm text-slate-400">Koi patient nahi mila.</p>}
      {list.map(p=><div key={p.id} className="flex items-center gap-3 px-5 py-3.5"><div className="grid h-10 w-10 place-items-center rounded-full bg-navy-50 text-sm font-bold text-navy">{p.name[0]}</div>
        <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="text-xs text-slate-400">{p.age&&p.age+'y · '}{p.sex} · {p.phone}</div></div>
        <span className="rounded-lg bg-navy-50 px-2 py-1 text-xs font-bold text-navy">{p.uhid}</span></div>)}</div>
    {open&&<div className="fixed inset-0 z-30 grid place-items-end bg-slate-900/40 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <form onSubmit={save} className="card max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-b-none p-6 sm:rounded-b-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-navy">New registration</h2><button type="button" onClick={()=>setOpen(false)}><X/></button></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F k="name" label="Patient name *" req/><F k="phone" label="Phone"/>
          <F k="age" label="Age" type="number"/><F label="Sex"><select className="inp" value={f.sex} onChange={set('sex')}><option>Male</option><option>Female</option><option>Other</option></select></F>
          <div className="sm:col-span-2"><F k="address" label="Address"/></div>
          <F label="Visit type"><select className="inp" value={f.kind} onChange={set('kind')}><option>OPD</option><option>IPD</option></select></F><F k="consultant" label="Consultant"/>
          <F k="fee" label="Fee (₹)" type="number"/><F k="discount" label="Discount (₹)" type="number"/>
          <F k="paid" label="Amount paid (₹)" type="number"/><F label="Mode"><select className="inp" value={f.mode} onChange={set('mode')}><option>Cash</option><option>UPI</option><option>Card</option></select></F></div>
        <button className="btn w-full" disabled={busy}>{busy?'Saving…':'Register & generate UHID / OPD no.'}</button></form></div>}
  </div>
}
