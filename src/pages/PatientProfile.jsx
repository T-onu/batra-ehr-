import { useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Save } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
import Receipt from '../components/Receipt'
const dt=d=>d?new Date(d).toLocaleDateString('en-GB'):'—'
export default function PatientProfile({id,profile,onBack}){
  const isAdm=['Admin','Super Admin'].includes(profile?.role)
  const [p,setP]=useState(null),[d,setD]=useState({visits:[],exams:[],bills:[],adm:[],docs:[],inv:[]}),[ed,setEd]=useState(false),[f,setF]=useState({}),[show,setShow]=useState(null),[msg,setMsg]=useState('')
  const load=async()=>{const [a,v,e,b,m,dc,iv]=await Promise.all([supabase.from('patients').select('*').eq('id',id).single(),
    supabase.from('visits').select('*').eq('patient_id',id).order('created_at',{ascending:false}),
    supabase.from('exams').select('*, visits(visit_no,visit_date)').eq('patient_id',id).order('created_at',{ascending:false}),
    supabase.from('bills').select('*').eq('patient_id',id).order('created_at',{ascending:false}),
    supabase.from('admissions').select('*, beds(bed_no)').eq('patient_id',id).order('created_at',{ascending:false}),
    supabase.from('documents').select('*').eq('patient_id',id).is('deleted_at',null).order('created_at',{ascending:false}),
    supabase.from('investigations').select('*').eq('patient_id',id).order('created_at',{ascending:false})])
    setP(a.data);setF(a.data||{});setD({visits:v.data||[],exams:e.data||[],bills:b.data||[],adm:m.data||[],docs:dc.data||[],inv:iv.data||[]})}
  useEffect(()=>{load()},[id])
  const save=async()=>{if(!f.name?.trim())return setMsg('Naam zaruri hai');const {error}=await supabase.from('patients').update({name:f.name.trim(),age:f.age||null,sex:f.sex,phone:f.phone,address:f.address}).eq('id',id)
    if(error)return setMsg(error.message);setMsg('Saved ✓');setEd(false);load()}
  const cancel=async b=>{const reason=prompt(`Bill ${b.bill_no} cancel karna hai. Reason likho (zaruri):`);if(!reason?.trim())return
    const {error}=await supabase.from('bills').update({status:'Cancelled',cancel_reason:reason.trim(),cancelled_at:new Date().toISOString()}).eq('id',b.id);if(error)alert(error.message);else load()}
  const openDoc=async x=>{const {data,error}=await supabase.storage.from('patient-docs').createSignedUrl(x.file_path,120);if(error)return alert(error.message);window.open(data.signedUrl,'_blank')}
  if(!p)return <p className="p-10 text-center text-sm text-slate-400">Loading…</p>
  const act=d.bills.filter(b=>b.status!=='Cancelled'),billed=act.reduce((a,b)=>a+Number(b.total),0),due=act.reduce((a,b)=>a+Number(b.total)-Number(b.paid),0)
  const S=({l,v,c})=><div className="card p-4"><div className={`text-xl font-extrabold ${c||'text-navy'}`}>{v}</div><div className="text-xs text-slate-500">{l}</div></div>
  const Sec=({t,n,children})=><div className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-3 font-bold text-navy">{t} <span className="text-xs font-medium text-slate-400">({n})</span></div><div className="divide-y divide-slate-100">{n===0?<p className="p-6 text-center text-xs text-slate-400">Kuch nahi.</p>:children}</div></div>
  return <div className="space-y-4"><button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-accent"><ArrowLeft size={16}/>Patients</button>
    <div className="card p-5">{ed?<div className="grid gap-3 sm:grid-cols-2">{[['name','Name'],['phone','Phone'],['age','Age'],['address','Address']].map(([k,l])=><div key={k}><label className="lbl">{l}</label><input className="inp" value={f[k]||''} onChange={e=>setF({...f,[k]:e.target.value})}/></div>)}
        <div><label className="lbl">Sex</label><select className="inp" value={f.sex||''} onChange={e=>setF({...f,sex:e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div>
        <div className="flex items-end gap-2"><button className="btn" onClick={save}><Save size={16}/>Save</button><button className="text-sm text-slate-400" onClick={()=>{setEd(false);setF(p)}}>Cancel</button></div></div>
      :<div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-full bg-navy text-xl font-extrabold text-white">{p.name[0]}</div>
        <div className="flex-1"><div className="text-xl font-extrabold text-navy">{p.name}</div><div className="text-xs text-slate-500">{p.uhid} · {p.age?p.age+'y · ':''}{p.sex} · {p.phone||'no phone'}</div><div className="text-xs text-slate-400">{p.address}</div></div>
        <button onClick={()=>setEd(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"><Pencil size={12} className="mr-1 inline"/>Edit</button></div>}
      {msg&&<p className="mt-2 text-xs text-emerald-600">{msg}</p>}</div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="Visits" v={d.visits.length}/><S l="Admissions" v={d.adm.length}/><S l="Total billed" v={inr(billed)}/><S l="Due" v={inr(due)} c={due>0?'text-red-600':'text-emerald-600'}/></div>
    <Sec t="Clinical exams" n={d.exams.length}>{d.exams.map(e=><div key={e.id} className="px-5 py-3 text-xs"><b className="text-navy">{e.visits?.visit_date} · {e.visits?.visit_no}</b> <span className="text-slate-400">{e.doctor}</span>
      <div className="text-slate-600">Dx: {e.data.diagnosis||'—'} · VA OD/OS: {e.data.vision?.dist?.od||'—'}/{e.data.vision?.dist?.os||'—'} · IOP: {e.data.iop?.od||'—'}/{e.data.iop?.os||'—'}</div><div className="text-slate-600">Rx: {e.data.treatment||'—'}</div></div>)}</Sec>
    <Sec t="Bills" n={d.bills.length}>{d.bills.map(b=>{const cx=b.status==='Cancelled';return <div key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"><button className="flex-1 text-left" onClick={()=>setShow({...b,patients:p})}><b>{b.bill_no}</b> <span className="text-xs text-slate-400">{b.bill_date} · {b.kind}</span>
      <div className="text-xs text-slate-500">{inr(b.total)} · paid {inr(b.paid)}{cx&&' · reason: '+b.cancel_reason}</div></button>
      {cx?<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">CANCELLED</span>:b.total-b.paid>0?<span className="text-xs font-bold text-red-600">Due {inr(b.total-b.paid)}</span>:<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">PAID</span>}
      {isAdm&&!cx&&<button className="text-xs text-red-500" onClick={()=>cancel(b)}>Cancel bill</button>}</div>})}</Sec>
    <Sec t="Admissions" n={d.adm.length}>{d.adm.map(a=><div key={a.id} className="px-5 py-3 text-xs"><b className="text-navy">{a.adm_no}</b> · {a.procedure} ({a.side}) · {a.status}<div className="text-slate-500">{dt(a.admitted_at)} → {dt(a.discharged_at)} · Bed {a.beds?.bed_no||'—'} · {a.category}</div></div>)}</Sec>
    <Sec t="Investigations" n={d.inv.length}>{d.inv.map(x=><div key={x.id} className="px-5 py-2.5 text-xs"><b>{x.name}</b> <span className="text-slate-400">· {x.context} · {new Date(x.created_at).toLocaleDateString('en-GB')} · {x.status}</span>{x.result&&<div className="text-slate-600">{x.result}</div>}</div>)}</Sec>
    <Sec t="Documents" n={d.docs.length}>{d.docs.map(x=><div key={x.id} className="flex items-center justify-between px-5 py-2.5 text-xs"><span><b>{x.name}</b> <span className="text-slate-400">· {x.doc_type} · {new Date(x.created_at).toLocaleDateString('en-GB')}</span></span><button className="font-semibold text-accent" onClick={()=>openDoc(x)}>Open</button></div>)}</Sec>
    <Sec t="Visits" n={d.visits.length}>{d.visits.map(v=><div key={v.id} className="flex justify-between px-5 py-2.5 text-xs"><span><b>{v.visit_no}</b> · {v.visit_date} · {v.consultant||'—'}</span><span className="text-slate-500">{v.status}</span></div>)}</Sec>
    {show&&<Receipt b={show} onClose={()=>setShow(null)}/>}</div>
}
