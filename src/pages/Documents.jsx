import { useEffect, useState } from 'react'
import { Upload, FileText, Image as Img } from 'lucide-react'
import { supabase } from '../lib/supabase'
import PatientPick from '../components/PatientPick'
const TYPES=['Clinical Document','Discharge Summary','Lab / Investigation Report','Aadhaar / ID','Insurance / Credit','Imaging','Referral Letter','Other'],OKM=['application/pdf','image/jpeg','image/png','image/webp']
export default function Documents({profile}){
  const canUp=['Reception','Doctor','Admin','Super Admin'].includes(profile?.role),isAdm=['Admin','Super Admin'].includes(profile?.role)
  const [pt,setPt]=useState(null),[docs,setDocs]=useState([]),[who,setWho]=useState({}),[type,setType]=useState(TYPES[0]),[name,setName]=useState(''),[notes,setNotes]=useState(''),[file,setFile]=useState(null),[err,setErr]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false)
  const load=async()=>{if(!pt){setDocs([]);return};const {data}=await supabase.from('documents').select('*').eq('patient_id',pt.id).is('deleted_at',null).order('created_at',{ascending:false});setDocs(data||[])}
  useEffect(()=>{load()},[pt]);useEffect(()=>{supabase.from('profiles').select('id,name').then(({data})=>setWho(Object.fromEntries((data||[]).map(p=>[p.id,p.name]))))},[])
  const upload=async()=>{setErr('');setMsg('');if(!pt)return setErr('Select a patient');if(!name.trim())return setErr('Enter a document name');if(!file)return setErr('Choose a file')
    if(!OKM.includes(file.type))return setErr('Only PDF, JPG, PNG or WEBP files are allowed');if(file.size>10*1024*1024)return setErr('File must be smaller than 10 MB')
    setBusy(true);const path=`${pt.id}/${Date.now()}_${file.name.replace(/[^A-Za-z0-9._-]/g,'_')}`
    const {error:e1}=await supabase.storage.from('patient-docs').upload(path,file,{contentType:file.type});if(e1){setBusy(false);return setErr(e1.message)}
    const {error:e2}=await supabase.from('documents').insert({patient_id:pt.id,doc_type:type,name:name.trim(),notes:notes.trim()||null,file_path:path,file_name:file.name,mime:file.type,size:file.size})
    if(e2){await supabase.storage.from('patient-docs').remove([path]).catch(()=>{});setBusy(false);return setErr(e2.message)}
    setBusy(false);setMsg('Document saved ✓');setName('');setNotes('');setFile(null);document.getElementById('docfile').value='';load()}
  const open=async d=>{const {data,error}=await supabase.storage.from('patient-docs').createSignedUrl(d.file_path,120);if(error)return alert(error.message);window.open(data.signedUrl,'_blank')}
  const remove=async d=>{const r=prompt(`"${d.name}" will be removed. Enter a reason (required):`);if(!r?.trim())return;const {error}=await supabase.from('documents').update({deleted_at:new Date().toISOString(),deleted_reason:r.trim(),deleted_by:profile.id}).eq('id',d.id);if(error)alert(error.message);else load()}
  return <div className="space-y-4"><div className="card space-y-3 p-5"><PatientPick pt={pt} setPt={setPt}/></div>
    {pt&&canUp&&<div className="card space-y-3 p-5"><h3 className="font-extrabold text-navy">New document</h3><div className="grid gap-3 sm:grid-cols-2">
      <div><label className="lbl">Type</label><select className="inp" value={type} onChange={e=>setType(e.target.value)}>{TYPES.map(t=><option key={t}>{t}</option>)}</select></div><div><label className="lbl">Document name *</label><input className="inp" value={name} onChange={e=>setName(e.target.value)}/></div>
      <div className="sm:col-span-2"><label className="lbl">Notes</label><input className="inp" value={notes} onChange={e=>setNotes(e.target.value)}/></div>
      <div className="sm:col-span-2"><label className="lbl">File (PDF / photo, max 10 MB)</label><input id="docfile" type="file" accept="application/pdf,image/*" className="inp" onChange={e=>setFile(e.target.files[0]||null)}/></div></div>
      {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}{msg&&<p className="text-sm font-semibold text-emerald-600">{msg}</p>}<button className="btn" disabled={busy} onClick={upload}><Upload size={16}/>{busy?'Uploading…':'Upload'}</button></div>}
    {pt&&!canUp&&<p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">Your role has view-only access to documents.</p>}
    {pt&&<div className="card divide-y divide-slate-100"><div className="px-5 py-3 font-bold text-navy">Saved documents <span className="text-xs font-medium text-slate-400">({docs.length})</span></div>{docs.length===0&&<p className="p-8 text-center text-sm text-slate-400">No scanned documents for this patient.</p>}
      {docs.map(d=><div key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">{d.mime==='application/pdf'?<FileText className="text-red-500"/>:<Img className="text-accent"/>}
        <div className="min-w-0 flex-1"><b>{d.name}</b> <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold text-navy">{d.doc_type}</span><div className="text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString('en-GB')} · {who[d.uploaded_by]||'—'} · {Math.round((d.size||0)/1024)} KB{d.notes&&' · '+d.notes}</div></div>
        <button className="btn !py-1.5 !text-xs" onClick={()=>open(d)}>Open</button>{isAdm&&<button className="text-xs text-red-500" onClick={()=>remove(d)}>Remove</button>}</div>)}</div>}</div>
}
