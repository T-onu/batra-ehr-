import { useEffect, useState } from 'react'
import { Eye, Save, History } from 'lucide-react'
import { supabase, today } from '../lib/supabase'
const eye=()=>({od:'',os:''})
const blank=()=>({complaints:'',diagnosis:'',pastHistory:'',systemic:'',
  vision:{dist:eye(),near:eye()},refraction:{od:{sph:'',cyl:'',axis:'',add:''},os:{sph:'',cyl:'',axis:'',add:''}},iop:eye(),
  slit:{lids:'',conj:'',cornea:'',ac:'',iris:'',pupil:'',lens:''},fundus:eye(),investigations:[],treatment:'',advice:'',followup:''})
const INV=['OCT','Fundus photo','Visual field','Topography','Pachymetry','Biometry (IOL)','A-Scan','B-Scan','FFA','NCT','Blood sugar']
const SLIT=[['lids','Lids'],['conj','Conjunctiva'],['cornea','Cornea'],['ac','Anterior chamber'],['iris','Iris'],['pupil','Pupil'],['lens','Lens']]
export default function Clinical({profile}){
  const [q,setQ]=useState([]),[sel,setSel]=useState(null),[f,setF]=useState(blank()),[hist,setHist]=useState([]),[doc,setDoc]=useState(profile?.name||''),[msg,setMsg]=useState('')
  const canEdit=['Doctor','Admin','Super Admin'].includes(profile?.role)
  const loadQ=async()=>{const {data}=await supabase.from('visits').select('*, patients(id,name,age,sex,phone,uhid)').eq('visit_date',today()).eq('kind','OPD').neq('status','Cancelled').order('token');setQ(data||[])}
  useEffect(()=>{loadQ();const ch=supabase.channel('clin').on('postgres_changes',{event:'*',schema:'public',table:'visits'},loadQ).subscribe();return()=>supabase.removeChannel(ch)},[])
  const open=async v=>{setSel(v);setMsg('');
    const {data:e}=await supabase.from('exams').select('*').eq('visit_id',v.id).maybeSingle(); setF(e?{...blank(),...e.data}:blank()); setDoc(e?.doctor||profile?.name||'')
    const {data:h}=await supabase.from('exams').select('*, visits(visit_date,visit_no)').eq('patient_id',v.patient_id).neq('visit_id',v.id).order('created_at',{ascending:false}).limit(5); setHist(h||[])
    if(v.status==='Waiting'&&canEdit)supabase.from('visits').update({status:'In Exam'}).eq('id',v.id)}
  const put=(path,val)=>setF(p=>{const n=structuredClone(p);let o=n;path.slice(0,-1).forEach(k=>o=o[k]);o[path.at(-1)]=val;return n})
  const save=async()=>{const {error}=await supabase.from('exams').upsert({visit_id:sel.id,patient_id:sel.patient_id,doctor:doc,data:f,updated_at:new Date().toISOString()},{onConflict:'visit_id'})
    if(error)return setMsg('Error: '+error.message); await supabase.from('visits').update({status:'Done'}).eq('id',sel.id); setMsg('Exam saved ✓ — visit Done mark ho gaya')}
  const T=(label,path,rows=2)=><div><label className="lbl">{label}</label><textarea rows={rows} className="inp" disabled={!canEdit} value={path.reduce((o,k)=>o[k],f)} onChange={e=>put(path,e.target.value)}/></div>
  const In=(path,ph)=><input className="inp !px-2 text-center" placeholder={ph} disabled={!canEdit} value={path.reduce((o,k)=>o[k],f)} onChange={e=>put(path,e.target.value)}/>
  const Sec=({t,children})=><div className="card space-y-3 p-5"><h3 className="font-extrabold text-navy">{t}</h3>{children}</div>
  if(!sel)return <div className="space-y-3"><p className="text-sm text-slate-500">Aaj ke OPD patients — exam ke liye select karo.</p>
    <div className="card divide-y divide-slate-100">{q.length===0&&<p className="p-10 text-center text-sm text-slate-400">Aaj koi OPD patient nahi.</p>}
      {q.map(v=><button key={v.id} onClick={()=>open(v)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-sm font-extrabold text-white">{v.token}</span>
        <span className="flex-1"><b className="block text-sm">{v.patients?.name}</b><span className="text-xs text-slate-400">{v.patients?.uhid} · {v.patients?.age}y {v.patients?.sex}</span></span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{v.status}</span></button>)}</div></div>
  return <div className="space-y-4">
    <div className="card flex flex-wrap items-center gap-3 bg-gradient-to-r from-navy to-accent p-5 text-white"><Eye/>
      <div className="flex-1"><div className="text-xs text-blue-100">{sel.patients.uhid} · {sel.visit_no}</div><div className="text-xl font-extrabold">{sel.patients.name}</div><div className="text-xs text-blue-100">{sel.patients.age}y · {sel.patients.sex} · {sel.patients.phone}</div></div>
      <button className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold" onClick={()=>setSel(null)}>← Queue</button></div>
    {!canEdit&&<p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">Aapka role sirf dekh sakta hai, exam sirf Doctor/Admin edit kar sakte hain.</p>}
    <div className="grid gap-4 xl:grid-cols-2">
      <Sec t="History"><div className="grid gap-3 sm:grid-cols-2">{T('Chief complaints',['complaints'],3)}{T('Diagnosis',['diagnosis'],3)}{T('Past surgery / medications',['pastHistory'],3)}{T('Systemic illness / allergy',['systemic'],3)}</div></Sec>
      <Sec t="Vision, refraction & IOP"><div className="grid grid-cols-[84px_1fr_1fr] items-center gap-2 text-sm">
        <span/><b className="text-center">OD</b><b className="text-center">OS</b>
        <span className="font-semibold">Distance</span>{In(['vision','dist','od'],'6/6')}{In(['vision','dist','os'],'6/6')}
        <span className="font-semibold">Near</span>{In(['vision','near','od'],'N6')}{In(['vision','near','os'],'N6')}
        <span className="font-semibold">IOP</span>{In(['iop','od'],'mmHg')}{In(['iop','os'],'mmHg')}</div>
        <div className="grid grid-cols-[84px_repeat(4,1fr)] items-center gap-2 pt-2 text-sm"><span/>{['Sph','Cyl','Axis','Add'].map(h=><b key={h} className="text-center text-xs">{h}</b>)}
          {['od','os'].map(e=><><b key={e} className="uppercase">{e}</b>{['sph','cyl','axis','add'].map(k=><span key={k}>{In(['refraction',e,k],'')}</span>)}</>)}</div></Sec>
      <Sec t="Slit lamp"><div className="grid gap-3 sm:grid-cols-2">{SLIT.map(([k,l])=><div key={k}><label className="lbl">{l}</label><input className="inp" disabled={!canEdit} value={f.slit[k]} onChange={e=>put(['slit',k],e.target.value)}/></div>)}</div></Sec>
      <Sec t="Fundus"><div className="grid gap-3 sm:grid-cols-2">{T('OD',['fundus','od'],3)}{T('OS',['fundus','os'],3)}</div></Sec>
      <Sec t="Investigations advised"><div className="flex flex-wrap gap-2">{INV.map(x=>{const on=f.investigations.includes(x);return <button key={x} type="button" disabled={!canEdit} onClick={()=>put(['investigations'],on?f.investigations.filter(y=>y!==x):[...f.investigations,x])}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${on?'border-accent bg-accent text-white':'border-slate-200 text-slate-500'}`}>{x}</button>})}</div></Sec>
      <Sec t="Treatment & advice">{T('Treatment / prescription',['treatment'],4)}{T('Advice',['advice'],2)}<div><label className="lbl">Follow-up</label><input className="inp" placeholder="e.g. 1 week" disabled={!canEdit} value={f.followup} onChange={e=>put(['followup'],e.target.value)}/></div></Sec></div>
    {hist.length>0&&<Sec t="Pichhli visits"><div className="space-y-2">{hist.map(h=><div key={h.id} className="rounded-xl bg-slate-50 p-3 text-xs"><b className="flex items-center gap-1 text-navy"><History size={12}/>{h.visits?.visit_date} · {h.visits?.visit_no}</b><div className="mt-1 text-slate-600">Dx: {h.data.diagnosis||'—'} · Rx: {h.data.treatment||'—'}</div></div>)}</div></Sec>}
    {canEdit&&<div className="sticky bottom-20 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 backdrop-blur md:bottom-4"><input className="inp max-w-[220px]" placeholder="Doctor name" value={doc} onChange={e=>setDoc(e.target.value)}/>
      <span className="flex-1 text-xs font-medium text-emerald-600">{msg}</span><button className="btn" onClick={save}><Save size={16}/>Save exam</button></div>}</div>
}
