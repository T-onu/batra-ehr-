import { useEffect, useState } from 'react'
import { istFee } from '../components/OpdRegister'
const greet=()=>{const h=(+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',hour12:false}).format(new Date()))%24;return h<12?'Good morning':h<17?'Good afternoon':'Good evening'}
import { Users, UserPlus, Stethoscope, BedDouble, IndianRupee } from 'lucide-react'
import { supabase, inr, today } from '../lib/supabase'
import PatientProfile from './PatientProfile'
const Stat=({I,label,value,tone})=><div className="card flex items-center gap-4 p-5"><div className={`grid h-12 w-12 place-items-center rounded-2xl ${tone}`}><I size={22}/></div>
  <div><div className="text-2xl font-extrabold text-navy">{value}</div><div className="text-xs font-medium text-slate-500">{label}</div></div></div>
export default function Dashboard({profile}){
  const nm=(profile?.name||'').includes('@')?'':(profile?.name||'').split(' ')[0]
  const isMgmt=['Admin','Super Admin'].includes(profile?.role),[s,setS]=useState({patients:'–',reg:'–',opd:'–',ipd:'–',cash:'–'}),[rows,setRows]=useState([]),[exp,setExp]=useState(0),[viewId,setViewId]=useState(null)
  useEffect(()=>{(async()=>{
    const st0=new Date();st0.setHours(0,0,0,0);const p=await supabase.from('patients').select('*',{count:'exact',head:true}),nr=await supabase.from('patients').select('*',{count:'exact',head:true}).gte('created_at',st0.toISOString())
    const v=await supabase.from('visits').select('*, patients(id,name,uhid)').eq('visit_date',today()).order('created_at',{ascending:false})
    const d=v.data||[]; setRows(d)
    const st=new Date();st.setHours(0,0,0,0);const pay=await supabase.from('payments').select('amount').gte('created_at',st.toISOString())
    const d60=new Date();d60.setDate(d60.getDate()+60);const ex=await supabase.from('stock_items').select('*',{count:'exact',head:true}).eq('module','pharmacy').gt('qty_on_hand',0).lte('expiry',d60.toLocaleDateString('en-CA'));setExp(ex.count??0)
    const a=await supabase.from('admissions').select('*',{count:'exact',head:true}).eq('status','Admitted')
    setS({patients:p.count??0,reg:nr.count??0,opd:d.filter(x=>x.kind==='OPD').length,ipd:a.count??0,cash:inr((pay.data||[]).reduce((a,x)=>a+Number(x.amount),0))})})()},[])
  if(viewId)return <PatientProfile id={viewId} profile={profile} onBack={()=>setViewId(null)}/>
  return <div className="space-y-6">
    <div className="card flex flex-wrap items-center gap-4 bg-gradient-to-r from-navy via-navy-700 to-accent p-5 text-white sm:p-6"><div className="min-w-0 flex-1"><div className="text-xs text-blue-200">{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'})}</div><div className="mt-1 text-xl font-extrabold sm:text-2xl">{greet()}{nm?`, ${nm}`:''}</div></div>
      <div className="rounded-2xl bg-white/15 px-5 py-2.5 text-center"><div className="text-[10px] uppercase tracking-wider text-blue-100">OPD fee right now</div><div className="text-2xl font-extrabold">₹{istFee()}</div></div></div>
    {exp>0&&<div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800">⚠ {exp} pharmacy batch(es) expired or expiring within 60 days — see Pharmacy → Stock.</div>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {isMgmt?<Stat I={Users} label="Total patients" value={s.patients} tone="bg-blue-50 text-accent"/>:<Stat I={UserPlus} label="Registered today" value={s.reg} tone="bg-blue-50 text-accent"/>}
      <Stat I={Stethoscope} label="Today OPD" value={s.opd} tone="bg-emerald-50 text-emerald-600"/>
      <Stat I={BedDouble} label="IPD admitted now" value={s.ipd} tone="bg-amber-50 text-amber-600"/>
      <Stat I={IndianRupee} label="Today collection" value={s.cash} tone="bg-violet-50 text-violet-600"/></div>
    <div className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4 font-bold text-navy">Today's visits <span className="text-xs font-medium text-slate-400">· tap a patient to open the profile</span></div>
      <div className="divide-y divide-slate-100">{rows.length===0&&<p className="p-8 text-center text-sm text-slate-400">No visits yet today.</p>}
        {rows.map(r=><div key={r.id} onClick={()=>r.patients?.id&&setViewId(r.patients.id)} className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm transition hover:bg-slate-50"><div><b>{r.patients?.name}</b><div className="text-xs text-slate-400">{r.patients?.uhid} · {r.visit_no}</div></div>
          <div className="text-right"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.kind==='OPD'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{r.kind}</span><div className="mt-0.5 text-xs text-slate-500">{r.status}</div></div></div>)}</div></div></div>
}
