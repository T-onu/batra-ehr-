import { useEffect, useState } from 'react'
import { Save, Printer, Plus, Trash2 } from 'lucide-react'
import { supabase, today } from '../lib/supabase'
import PrintSheet from '../components/PrintSheet'
const blank=()=>({diagnosis:'',procedure:'',notes:'',course:'',condition:'Stable, eye comfortable',meds:[{n:'',dose:'',freq:'',days:''}],advice:'',followup:'',date:today()})
const fmt=d=>d?new Date(d).toLocaleDateString('en-GB'):'—'
export default function Discharge({profile}){
  const canEdit=['Doctor','Admin','Super Admin'].includes(profile?.role)
  const [list,setList]=useState([]),[sel,setSel]=useState(null),[f,setF]=useState(blank()),[doc,setDoc]=useState(''),[msg,setMsg]=useState(''),[show,setShow]=useState(false)
  useEffect(()=>{supabase.from('admissions').select('*, patients(name,uhid,age,sex,phone), beds(bed_no,ward)').in('status',['Admitted','Discharged']).order('created_at',{ascending:false}).limit(40).then(({data})=>setList(data||[]))},[])
  const open=async a=>{setSel(a);setMsg('');const {data:e}=await supabase.from('discharge_summaries').select('*').eq('admission_id',a.id).maybeSingle()
    setF(e?{...blank(),...e.data}:{...blank(),procedure:`${a.procedure} (${a.side})`,date:a.discharged_at?a.discharged_at.slice(0,10):today()});setDoc(e?.doctor||a.surgeon||profile?.name||'')}
  const set=k=>e=>setF({...f,[k]:e.target.value}),med=(i,k,v)=>setF({...f,meds:f.meds.map((m,j)=>j===i?{...m,[k]:v}:m)})
  const save=async()=>{const {error}=await supabase.from('discharge_summaries').upsert({admission_id:sel.id,patient_id:sel.patient_id,doctor:doc,data:f,updated_at:new Date().toISOString()},{onConflict:'admission_id'});setMsg(error?'Error: '+error.message:'Saved ✓')}
  const T=(l,k,r=3)=><div><label className="lbl">{l}</label><textarea rows={r} className="inp" disabled={!canEdit} value={f[k]} onChange={set(k)}/></div>
  if(!sel)return <div className="space-y-3"><p className="text-sm text-slate-500">Admitted ya discharged patient chuno — discharge card banane / print karne ke liye.</p>
    <div className="card divide-y divide-slate-100">{list.length===0&&<p className="p-10 text-center text-sm text-slate-400">Abhi koi admission nahi.</p>}
      {list.map(a=><button key={a.id} onClick={()=>open(a)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50"><span className="flex-1"><b className="block text-sm">{a.patients?.name}</b><span className="text-xs text-slate-400">{a.adm_no} · {a.procedure} ({a.side})</span></span>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${a.status==='Admitted'?'bg-red-50 text-red-600':'bg-emerald-50 text-emerald-700'}`}>{a.status}</span></button>)}</div></div>
  const p=sel.patients
  return <div className="space-y-4"><div className="card flex items-center gap-3 bg-gradient-to-r from-navy to-accent p-5 text-white"><div className="flex-1"><div className="text-xs text-blue-100">{p.uhid} · {sel.adm_no}</div><div className="text-xl font-extrabold">{p.name}</div><div className="text-xs text-blue-100">{sel.procedure} ({sel.side})</div></div>
      <button className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold" onClick={()=>setSel(null)}>← List</button></div>
    {!canEdit&&<p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">Sirf Doctor/Admin card edit kar sakte hain. Aap print dekh sakte ho.</p>}
    <div className="card grid gap-3 p-5 sm:grid-cols-2">{T('Final diagnosis','diagnosis',2)}{T('Procedure performed','procedure',2)}{T('Operative notes','notes')}{T('Hospital course','course')}
      <div><label className="lbl">Condition at discharge</label><input className="inp" disabled={!canEdit} value={f.condition} onChange={set('condition')}/></div><div><label className="lbl">Discharge date</label><input type="date" className="inp" disabled={!canEdit} value={f.date} onChange={set('date')}/></div></div>
    <div className="card space-y-3 p-5"><h3 className="font-extrabold text-navy">Medicines on discharge</h3>
      {f.meds.map((m,i)=><div key={i} className="grid grid-cols-[1fr_80px_90px_60px_28px] gap-2">{[['n','Medicine'],['dose','Dose'],['freq','Frequency'],['days','Days']].map(([k,ph])=><input key={k} className="inp !px-2" placeholder={ph} disabled={!canEdit} value={m[k]} onChange={e=>med(i,k,e.target.value)}/>)}
        <button disabled={!canEdit} onClick={()=>setF({...f,meds:f.meds.length>1?f.meds.filter((_,j)=>j!==i):f.meds})} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div>)}
      {canEdit&&<button className="text-xs font-semibold text-accent" onClick={()=>setF({...f,meds:[...f.meds,{n:'',dose:'',freq:'',days:''}]})}><Plus size={12} className="inline"/> Add medicine</button>}</div>
    <div className="card grid gap-3 p-5 sm:grid-cols-2">{T('Advice','advice',3)}{T('Follow-up','followup',3)}</div>
    <div className="sticky bottom-20 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 backdrop-blur md:bottom-4"><input className="inp max-w-[220px]" placeholder="Doctor / surgeon" disabled={!canEdit} value={doc} onChange={e=>setDoc(e.target.value)}/>
      <span className="flex-1 text-xs font-medium text-emerald-600">{msg}</span>{canEdit&&<button className="btn" onClick={save}><Save size={16}/>Save</button>}<button className="btn !bg-emerald-600" onClick={()=>setShow(true)}><Printer size={16}/>Print card</button></div>
    {show&&<PrintSheet title="DISCHARGE CARD" meta={[sel.adm_no,'UHID '+p.uhid]} onClose={()=>setShow(false)}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs"><div>Patient: <b>{p.name}</b></div><div>Age / Sex: <b>{p.age||'—'} / {p.sex||'—'}</b></div><div>Admitted: <b>{fmt(sel.admitted_at)}</b></div><div>Discharged: <b>{fmt(f.date)}</b></div><div>Bed: <b>{sel.beds?.bed_no||'—'}</b></div><div>Category: <b>{sel.category}</b></div></div>
      {[['Final diagnosis',f.diagnosis],['Procedure performed',f.procedure],['Operative notes',f.notes],['Hospital course',f.course],['Condition at discharge',f.condition]].filter(x=>x[1]).map(([h,v])=><div key={h}><b className="text-navy">{h}</b><p className="whitespace-pre-line text-xs">{v}</p></div>)}
      {f.meds.some(m=>m.n)&&<div><b className="text-navy">Medicines</b><table className="mt-1 w-full text-left text-xs"><thead><tr className="border-y bg-slate-50"><th className="p-1.5">#</th><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Days</th></tr></thead><tbody>{f.meds.filter(m=>m.n).map((m,i)=><tr key={i} className="border-b border-slate-100"><td className="p-1.5">{i+1}</td><td>{m.n}</td><td>{m.dose}</td><td>{m.freq}</td><td>{m.days}</td></tr>)}</tbody></table></div>}
      {f.advice&&<div><b className="text-navy">Advice</b><p className="whitespace-pre-line text-xs">{f.advice}</p></div>}{f.followup&&<div><b className="text-navy">Follow-up</b><p className="whitespace-pre-line text-xs">{f.followup}</p></div>}
      <div className="flex justify-between pt-10 text-xs"><span className="text-slate-400">Bring this card on every visit.</span><span className="border-t border-slate-400 px-6 pt-1">{doc||'Doctor'}</span></div></PrintSheet>}</div>
}
