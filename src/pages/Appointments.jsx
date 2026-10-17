import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { supabase, today } from '../lib/supabase'
const TONE={Booked:'bg-blue-50 text-accent',Arrived:'bg-emerald-50 text-emerald-700',Cancelled:'bg-slate-100 text-slate-400','No-show':'bg-red-50 text-red-600'}
export default function Appointments(){
  const [d,setD]=useState(today()),[rows,setRows]=useState([]),[f,setF]=useState({name:'',phone:'',appt_time:'',consultant:'',reason:''}),[open,setOpen]=useState(false),[err,setErr]=useState('')
  const load=async()=>{const {data}=await supabase.from('appointments').select('*').eq('appt_date',d).order('appt_time');setRows(data||[])}
  useEffect(()=>{load();const ch=supabase.channel('appt').on('postgres_changes',{event:'*',schema:'public',table:'appointments'},load).subscribe();return()=>supabase.removeChannel(ch)},[d])
  const add=async e=>{e.preventDefault();const {error}=await supabase.from('appointments').insert({...f,appt_time:f.appt_time||null,appt_date:d});if(error)return setErr(error.message);setF({name:'',phone:'',appt_time:'',consultant:'',reason:''});setOpen(false);setErr('')}
  const st=(id,status)=>supabase.from('appointments').update({status}).eq('id',id)
  const I=(k,l,t='text',r)=><div><label className="lbl">{l}</label><input className="inp" type={t} required={r} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></div>
  return <div className="space-y-4"><div className="flex gap-3"><input type="date" className="inp max-w-[200px]" value={d} onChange={e=>setD(e.target.value)}/>
    <button className="btn ml-auto" onClick={()=>setOpen(!open)}><Plus size={16}/>Book</button></div>
    {open&&<form onSubmit={add} className="card grid gap-3 p-5 sm:grid-cols-2">{I('name','Patient name *','text',1)}{I('phone','Phone')}{I('appt_time','Time','time')}{I('consultant','Consultant')}
      <div className="sm:col-span-2">{I('reason','Reason')}</div>{err&&<p className="text-xs text-red-600 sm:col-span-2">{err}</p>}<button className="btn sm:col-span-2">Save appointment</button></form>}
    <div className="card divide-y divide-slate-100">{rows.length===0&&<p className="p-10 text-center text-sm text-slate-400">No appointments on this day.</p>}
      {rows.map(r=><div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5"><div className="w-16 text-sm font-bold text-navy">{r.appt_time?.slice(0,5)||'—'}</div>
        <div className="min-w-0 flex-1"><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-400">{r.phone} · {r.consultant||'—'} {r.reason&&'· '+r.reason}</div></div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${TONE[r.status]}`}>{r.status}</span>
        {r.status==='Booked'&&<><button className="btn !py-1.5 !text-xs" onClick={()=>st(r.id,'Arrived')}>Arrived</button><button className="text-xs text-slate-400" onClick={()=>st(r.id,'No-show')}>No-show</button></>}</div>)}</div></div>
}
