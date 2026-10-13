import { useEffect, useState } from 'react'
import { Users, Stethoscope, BedDouble, IndianRupee } from 'lucide-react'
import { supabase, inr, today } from '../lib/supabase'
const Stat=({I,label,value,tone})=><div className="card flex items-center gap-4 p-5"><div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><I size={22}/></div>
  <div><div className="text-2xl font-extrabold text-navy">{value}</div><div className="text-xs font-medium text-slate-500">{label}</div></div></div>
export default function Dashboard(){
  const [s,setS]=useState({patients:'–',opd:'–',ipd:'–',cash:'–'}),[rows,setRows]=useState([])
  useEffect(()=>{(async()=>{
    const p=await supabase.from('patients').select('*',{count:'exact',head:true})
    const v=await supabase.from('visits').select('*, patients(name,uhid)').eq('visit_date',today()).order('created_at',{ascending:false})
    const d=v.data||[]; setRows(d)
    const a=await supabase.from('admissions').select('*',{count:'exact',head:true}).eq('status','Admitted')
    setS({patients:p.count??0,opd:d.filter(x=>x.kind==='OPD').length,ipd:a.count??0,cash:inr(d.reduce((a,x)=>a+Number(x.paid||0),0))})})()},[])
  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat I={Users} label="Total patients" value={s.patients} tone="bg-blue-50 text-accent"/>
      <Stat I={Stethoscope} label="Today OPD" value={s.opd} tone="bg-emerald-50 text-emerald-600"/>
      <Stat I={BedDouble} label="IPD admitted now" value={s.ipd} tone="bg-amber-50 text-amber-600"/>
      <Stat I={IndianRupee} label="Today collection" value={s.cash} tone="bg-violet-50 text-violet-600"/></div>
    <div className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 font-bold text-navy">Today's visits</div>
      <div className="divide-y divide-slate-100">{rows.length===0&&<p className="p-8 text-center text-sm text-slate-400">Aaj abhi koi visit nahi.</p>}
        {rows.map(r=><div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm"><div><b>{r.patients?.name}</b><div className="text-xs text-slate-400">{r.patients?.uhid} · {r.visit_no}</div></div>
          <div className="text-right"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.kind==='OPD'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{r.kind}</span><div className="mt-0.5 text-xs text-slate-500">{inr(r.paid)}</div></div></div>)}</div></div></div>
}
