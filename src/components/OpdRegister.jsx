import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
const AUTH=['Dr. Akhil Batra','Dr. Sunanda','Other']
// OPD fee by India time: Rs 100 from 8:30 AM to 4:00 PM, Rs 200 at other times (the database applies the same rule)
export const istFee=()=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()),t=(+p.find(x=>x.type==='hour').value%24)*60+(+p.find(x=>x.type==='minute').value);return t>=510&&t<=960?100:200}
const blank={name:'',age:'',sex:'Male',phone:'',address:'',consultant:'',discount:'',au:AUTH[0],auO:'',paid:'',mode:'Cash'}
export default function OpdRegister({patient,onDone,onClose}){
  const [f,setF]=useState(blank),[fee,setFee]=useState(istFee()),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  useEffect(()=>{const t=setInterval(()=>setFee(istFee()),20000);return()=>clearInterval(t)},[])
  const set=k=>e=>setF({...f,[k]:e.target.value}),d=+f.discount||0,net=Math.max(0,fee-d),paid=f.paid===''?net:+f.paid
  const submit=async e=>{e.preventDefault();setErr('')
    if(!patient&&f.phone.trim()){const {data:dup}=await supabase.from('patients').select('name,uhid').eq('phone',f.phone.trim()).limit(1)
      if(dup?.length&&!confirm(`A patient with this phone number already exists: ${dup[0].name} (${dup[0].uhid}).\nCreate a new patient anyway?`))return}
    setBusy(true);const {data,error}=await supabase.rpc('register_opd',{p_patient:patient?.id||null,p_name:f.name,p_age:f.age?+f.age:null,p_sex:f.sex,p_phone:f.phone,p_address:f.address,p_consultant:f.consultant,p_discount:d,p_authority:f.au==='Other'?f.auO:f.au,p_paid:paid,p_mode:f.mode})
    setBusy(false);if(error)return setErr(error.message);onDone(data)}
  const I=(k,l,t='text',req)=><div><label className="lbl">{l}</label><input className="inp" type={t} required={req} value={f[k]} onChange={set(k)}/></div>
  return <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 backdrop-blur-sm sm:place-items-center sm:p-4">
    <form onSubmit={submit} className="card max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl sm:p-6">
      <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-navy">{patient?`New OPD visit — ${patient.name}`:'New patient registration'}</h2><button type="button" onClick={onClose}><X/></button></div>
      {!patient&&<div className="grid gap-3 sm:grid-cols-2">{I('name','Patient name *','text',true)}{I('phone','Phone','tel')}{I('age','Age','number')}
        <div><label className="lbl">Sex</label><select className="inp" value={f.sex} onChange={set('sex')}><option>Male</option><option>Female</option><option>Other</option></select></div><div className="sm:col-span-2">{I('address','Address')}</div></div>}
      <div className="flex items-center justify-between rounded-2xl bg-navy-50 p-4"><div><div className="text-xs font-semibold text-slate-500">OPD consultation fee (automatic)</div><div className="text-[11px] text-slate-400">₹100 from 8:30 AM to 4:00 PM · ₹200 at other times (India time)</div></div><div className="text-3xl font-extrabold text-navy">{inr(fee)}</div></div>
      <div className="grid gap-3 sm:grid-cols-2">{I('consultant','Consultant')}{I('discount','Discount (₹)','number')}
        {d>0&&<div className="sm:col-span-2"><label className="lbl">Discount authority *</label><select className="inp" value={f.au} onChange={set('au')}>{AUTH.map(a=><option key={a}>{a}</option>)}</select>{f.au==='Other'&&<input className="inp mt-2" placeholder="Full name" value={f.auO} onChange={set('auO')}/>}</div>}
        <div><label className="lbl">Amount paid (₹)</label><input className="inp" type="number" value={f.paid===''?net:f.paid} onChange={set('paid')}/></div>
        <div><label className="lbl">Payment mode</label><select className="inp" value={f.mode} onChange={set('mode')}><option>Cash</option><option>UPI</option><option>Card</option></select></div></div>
      <div className="flex justify-between text-sm"><span className="text-slate-500">Net payable {inr(net)}</span><span className={paid<net?'font-semibold text-red-600':'font-semibold text-emerald-600'}>Balance {inr(Math.max(0,net-paid))}</span></div>
      {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <button className="btn w-full" disabled={busy}>{busy?'Saving…':'Register & print receipt'}</button></form></div>
}
