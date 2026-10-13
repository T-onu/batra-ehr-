import { useEffect, useState } from 'react'
import { Search, X, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
const PROC=['Phaco with foldable IOL','SICS','Pterygium surgery','Trabeculectomy','Vitrectomy','DCR','Squint surgery','Corneal transplant','Intravitreal injection']
const CATS=['Cash','Insurance','Government scheme','Other']
const F0={procedure:'',side:'OS',surgeon:'Dr Akhil Batra',bed_id:'',preop:'Fit for surgery',category:'Cash',refer_no:'',planned_date:'',advance:'',mode:'now'}
export default function Ipd({profile}){
  const canWrite=['Doctor','Reception','Billing','Admin','Super Admin'].includes(profile?.role),isAdm=['Admin','Super Admin'].includes(profile?.role)
  const [tab,setTab]=useState('beds'),[beds,setBeds]=useState([]),[adm,setAdm]=useState([]),[f,setF]=useState(F0),[q,setQ]=useState(''),[res,setRes]=useState([]),[pt,setPt]=useState(null),
    [err,setErr]=useState(''),[busy,setBusy]=useState(false),[nb,setNb]=useState({ward:'',bed_no:''}),[pick,setPick]=useState({})
  const load=async()=>{const [b,a]=await Promise.all([supabase.from('beds').select('*').eq('active',true),
    supabase.from('admissions').select('*, patients(name,uhid,age,sex), beds(bed_no,ward)').in('status',['Admitted','Booked']).order('created_at',{ascending:false})])
    setBeds((b.data||[]).sort((x,y)=>x.ward.localeCompare(y.ward)||x.bed_no.localeCompare(y.bed_no,undefined,{numeric:true})));setAdm(a.data||[])}
  useEffect(()=>{load();const ch=supabase.channel('ipd').on('postgres_changes',{event:'*',schema:'public',table:'admissions'},load).subscribe();return()=>supabase.removeChannel(ch)},[])
  useEffect(()=>{if(!q.trim()){setRes([]);return};const t=setTimeout(async()=>{const {data}=await supabase.from('patients').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%,uhid.ilike.%${q}%`).limit(6);setRes(data||[])},250);return()=>clearTimeout(t)},[q])
  const adm_=adm.filter(a=>a.status==='Admitted'),occ=Object.fromEntries(adm_.filter(a=>!a.beds||true).map(a=>[a.bed_id,a])),isFree=b=>b.multi||!occ[b.id]
  const wards=[...new Set(beds.map(b=>b.ward))],freeBeds=beds.filter(isFree),set=k=>e=>setF({...f,[k]:e.target.value})
  const save=async()=>{setErr('');const book=f.mode==='book'
    if(!pt)return setErr('Patient select karo');if(!f.procedure.trim())return setErr('Procedure likho')
    if(book&&!f.planned_date)return setErr('Planned date daalo');if(!book&&!f.bed_id)return setErr('Bed chuno')
    setBusy(true);const {error}=await supabase.from('admissions').insert({patient_id:pt.id,procedure:f.procedure.trim(),side:f.side,surgeon:f.surgeon,bed_id:f.bed_id||null,preop:f.preop,category:f.category,
      refer_no:f.refer_no||null,planned_date:book?f.planned_date:null,advance:+f.advance||0,status:book?'Booked':'Admitted'});setBusy(false)
    if(error)return setErr(error.message);setPt(null);setQ('');setF(F0);setTab('list');load()}
  const act=async(a,patch,ask)=>{if(ask&&!confirm(ask))return;const {error}=await supabase.from('admissions').update(patch).eq('id',a.id);if(error)alert(error.message);else load()}
  const addBed=async()=>{if(!nb.ward.trim()||!nb.bed_no.trim())return;const {error}=await supabase.from('beds').insert({ward:nb.ward.trim(),bed_no:nb.bed_no.trim()});if(error)alert(error.message);else{setNb({ward:'',bed_no:''});load()}}
  const Row=({a})=><div className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm"><div className="min-w-0 flex-1"><b>{a.patients?.name}</b> <span className="text-xs text-slate-400">{a.patients?.uhid} · {a.adm_no}</span>
    <div className="text-xs text-slate-500">{a.procedure} ({a.side}) · {a.surgeon} · {a.category}{a.refer_no&&' · '+a.refer_no}</div></div>
    {a.status==='Admitted'?<><span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-600">{a.beds?.bed_no||'—'}</span>{canWrite&&<button className="btn !py-1.5 !text-xs" onClick={()=>act(a,{status:'Discharged',discharged_at:new Date().toISOString()},`${a.patients?.name} ko discharge karein?`)}>Discharge</button>}</>
    :<><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-accent">Booked {a.planned_date}</span>{canWrite&&<><select className="inp !w-32 !py-1.5" value={pick[a.id]||''} onChange={e=>setPick({...pick,[a.id]:e.target.value})}><option value="">Bed…</option>{freeBeds.map(b=><option key={b.id} value={b.id}>{b.bed_no}</option>)}</select>
      <button className="btn !py-1.5 !text-xs" onClick={()=>pick[a.id]?act(a,{status:'Admitted',bed_id:pick[a.id]}):alert('Pehle bed chuno')}>Admit</button><button className="text-xs text-slate-400" onClick={()=>act(a,{status:'Cancelled'},'Booking cancel karein?')}>Cancel</button></>}</>}</div>
  return <div className="space-y-4"><div className="flex gap-2">{[['beds','Bed map'],['admit','New admission'],['list','Admissions']].map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab===k?'bg-navy text-white':'bg-white text-slate-500'}`}>{l}</button>)}</div>
    {tab==='beds'&&<div className="space-y-4"><p className="text-xs text-slate-500">Admitted: <b className="text-navy">{adm_.length}</b> · Free beds: <b className="text-emerald-600">{beds.filter(b=>!b.multi&&!occ[b.id]).length}</b></p>
      {wards.map(w=><div key={w} className="card p-5"><h3 className="mb-3 font-extrabold text-navy">{w}</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {beds.filter(b=>b.ward===w).map(b=>{const o=occ[b.id],n=adm_.filter(a=>a.bed_id===b.id).length;return b.multi
          ?<button key={b.id} disabled={!canWrite} onClick={()=>{setF({...F0,bed_id:b.id});setTab('admit')}} className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50 p-3 text-left"><b className="text-sm">{b.bed_no}</b><div className="text-xs text-emerald-700">{n} admitted · + admit</div></button>
          :o?<div key={b.id} className="rounded-xl border-2 border-red-200 bg-red-50 p-3"><b className="text-sm">{b.bed_no}</b><div className="truncate text-xs font-semibold text-red-700">{o.patients?.name}</div><div className="truncate text-[10px] text-red-400">{o.procedure}</div></div>
          :<button key={b.id} disabled={!canWrite} onClick={()=>{setF({...F0,bed_id:b.id});setTab('admit')}} className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 text-left hover:border-emerald-400"><b className="text-sm">{b.bed_no}</b><div className="text-xs text-emerald-600">Free</div></button>})}</div></div>)}
      {isAdm&&<div className="card flex flex-wrap items-end gap-3 p-5"><div><label className="lbl">Ward</label><input className="inp" value={nb.ward} onChange={e=>setNb({...nb,ward:e.target.value})} placeholder="General"/></div><div><label className="lbl">Bed no.</label><input className="inp" value={nb.bed_no} onChange={e=>setNb({...nb,bed_no:e.target.value})} placeholder="G-11"/></div><button className="btn" onClick={addBed}><Plus size={16}/>Add bed</button></div>}</div>}
    {tab==='admit'&&<div className="card max-w-2xl space-y-4 p-6">{!canWrite&&<p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">Aapka role admission nahi bana sakta.</p>}
      <div><label className="lbl">Patient</label>{pt?<div className="flex items-center justify-between rounded-xl bg-navy-50 p-3"><div><b>{pt.name}</b><div className="text-xs text-slate-500">{pt.uhid} · {pt.phone}</div></div><button onClick={()=>setPt(null)}><X size={16}/></button></div>
        :<><div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder="Name / phone / UHID" value={q} onChange={e=>setQ(e.target.value)}/></div>{res.map(p=><button key={p.id} onClick={()=>setPt(p)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-400">{p.uhid}</span></button>)}</>}</div>
      <div className="flex gap-2">{[['now','Admit now'],['book','Book for later']].map(([k,l])=><button key={k} onClick={()=>setF({...f,mode:k})} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${f.mode===k?'border-accent bg-accent text-white':'border-slate-200 text-slate-500'}`}>{l}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><label className="lbl">Procedure *</label><input list="proc" className="inp" value={f.procedure} onChange={set('procedure')}/><datalist id="proc">{PROC.map(p=><option key={p}>{p}</option>)}</datalist></div>
        <div><label className="lbl">Eye</label><select className="inp" value={f.side} onChange={set('side')}><option>OD</option><option>OS</option><option>OU</option></select></div><div><label className="lbl">Surgeon</label><input className="inp" value={f.surgeon} onChange={set('surgeon')}/></div>
        {f.mode==='book'?<div><label className="lbl">Planned date *</label><input type="date" className="inp" value={f.planned_date} onChange={set('planned_date')}/></div>
          :<div><label className="lbl">Bed *</label><select className="inp" value={f.bed_id} onChange={set('bed_id')}><option value="">Select…</option>{freeBeds.map(b=><option key={b.id} value={b.id}>{b.ward} · {b.bed_no}</option>)}</select></div>}
        <div><label className="lbl">Pre-op status</label><input className="inp" value={f.preop} onChange={set('preop')}/></div>
        <div><label className="lbl">Category</label><select className="inp" value={f.category} onChange={set('category')}>{CATS.map(c=><option key={c}>{c}</option>)}</select></div><div><label className="lbl">Reference / policy no.</label><input className="inp" value={f.refer_no} onChange={set('refer_no')}/></div>
        {f.mode==='book'&&<div><label className="lbl">Advance (₹) — receipt Billing me banao</label><input type="number" className="inp" value={f.advance} onChange={set('advance')}/></div>}</div>
      {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}<button className="btn w-full" disabled={busy||!canWrite} onClick={save}>{busy?'Saving…':f.mode==='book'?'Save booking':'Admit patient'}</button></div>}
    {tab==='list'&&<div className="card divide-y divide-slate-100">{adm.length===0&&<p className="p-10 text-center text-sm text-slate-400">Abhi koi admitted ya booked patient nahi.</p>}{adm.map(a=><Row key={a.id} a={a}/>)}</div>}</div>
}
