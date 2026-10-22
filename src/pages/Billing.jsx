import { useEffect, useState } from 'react'
import { Search, X, Printer, FileCheck2 } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
import FinalBill from '../components/FinalBill'
const AUTH=['Dr. Akhil Batra','Dr. Sunanda','Other'],STATUS=['Discharged to Home','Referred to another hospital','LAMA (Left against medical advice)','DAMA (Discharged on request)','Absconded','Expired']
const dt=d=>d?new Date(d).toLocaleDateString('en-GB',{timeZone:'Asia/Kolkata'}):'—'
// IPD Consolidated Full & Final Bill. Everything is fetched from the patient's account; nothing is typed in manually.
export default function Billing({profile}){
  const canBill=['Admin','Super Admin'].includes(profile?.role)
  const [cat,setCat]=useState([]),[pr,setPr]=useState(''),[q,setQ]=useState(''),[hits,setHits]=useState([]),[pt,setPt]=useState(null),[adms,setAdms]=useState([]),[adm,setAdm]=useState(null),[bills,setBills]=useState([]),[pays,setPays]=useState([]),[others,setOthers]=useState([])
  const [f,setF]=useState({disc:'',au:AUTH[0],auO:'',paid:'',mode:'Cash',ref:'',status:STATUS[0]}),[err,setErr]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false),[show,setShow]=useState(false)
  useEffect(()=>{supabase.from('catalog_items').select('name,rate').eq('kind','ipd_procedure').eq('active',true).then(({data})=>setCat(data||[]))},[])
  const nb=x=>(x||'').replace(/^BEH-?/,'')
  const search=async()=>{setErr('');setHits([]);const t=q.trim().replace(/[,()%]/g,' ').trim();if(!t)return
    const u=/^\d{1,6}$/.test(t)?t.padStart(6,'0'):t
    const [p,a]=await Promise.all([supabase.from('patients').select('*').or(`uhid.ilike.${u},legacy_uhid.ilike.${t},name.ilike.%${t}%,phone.ilike.%${t}%`).limit(8),supabase.from('admissions').select('adm_no,patients(*)').or(`adm_no.ilike.${t},legacy_no.ilike.${t}`).limit(1)])
    if(a.data?.length)return pick(a.data[0].patients,a.data[0].adm_no)
    const l=p.data||[];if(l.length===1)pick(l[0]);else if(!l.length)setErr('No patient matches this name, UHID, phone or IPD number.');else setHits(l)}
  const pick=async(p,admNo)=>{setPt(p);setHits([]);setQ('');setMsg('');setErr('')
    const {data}=await supabase.from('admissions').select('*').eq('patient_id',p.id).in('status',['Admitted','Discharged']).order('created_at',{ascending:false});const l=data||[];setAdms(l)
    const {data:ob}=await supabase.from('bills').select('*').eq('patient_id',p.id).eq('status','Active').is('admission_id',null);setOthers((ob||[]).filter(b=>b.total-b.paid>0))
    const s=(admNo&&l.find(x=>x.adm_no===admNo))||l.find(x=>x.status==='Admitted')||l[0]||null;setAdm(s);if(s)loadBill(s)}
  const loadBill=async a=>{const {data:b}=await supabase.from('bills').select('*').eq('admission_id',a.id).order('created_at');setBills(b||[])
    const ids=(b||[]).map(x=>x.id);const {data:pm}=ids.length?await supabase.from('payments').select('*').in('bill_id',ids).order('created_at'):{data:[]};setPays(pm||[])
    setF(x=>({...x,disc:'',paid:'',ref:'',status:a.discharge_status||STATUS[0]}))}
  useEffect(()=>{if(adm)loadBill(adm)},[adm?.id])
  const act=bills.filter(b=>b.status==='Active'),sub=act.reduce((s,b)=>s+Number(b.subtotal),0),disc0=act.reduce((s,b)=>s+Number(b.discount),0),total0=act.reduce((s,b)=>s+Number(b.total),0)
  const ids=new Set(act.map(b=>b.id)),got=pays.filter(x=>ids.has(x.bill_id)&&!x.cancelled_at).reduce((s,x)=>s+Number(x.amount),0)
  const finalised=act.some(b=>b.finalized_at),d=+f.disc||0,net=Math.max(0,total0-d),bal=net-got,paid=f.paid===''?Math.max(0,bal):+f.paid
  const items=act.flatMap(b=>b.items||[])
  const procRate=(cat.find(c=>c.name.toLowerCase()===(adm?.procedure||'').trim().toLowerCase())||{}).rate
  const missing=adm&&!finalised&&canBill&&adm.procedure&&!items.some(x=>(x.d||'').toLowerCase()===adm.procedure.trim().toLowerCase())
  const addProc=async()=>{const r=pr!==''?+pr:procRate;if(!(r>=0)||r===undefined||r===null)return setErr('Enter the procedure charge');setBusy(true)
    const {error}=await supabase.rpc('ipd_add_service',{p_adm:adm.id,p_items:[{d:adm.procedure,q:1,r,c:'Procedure'}]});setBusy(false);if(error)return setErr(error.message);setPr('');setErr('');loadBill(adm)}
  const run=async()=>{setErr('');setMsg('')
    if(!items.length)return setErr('This admission has no billed services yet. Add them in Money Receipt → Add IPD service.')
    if(d>0&&!(f.au==='Other'?f.auO.trim():f.au))return setErr('Select the discount authority')
    if(bal<0)return setErr(`The patient has paid ${inr(-bal)} more than the bill. Refund the extra amount first (Money Receipt).`)
    if(paid!==Math.max(0,bal))return setErr(`A full and final bill needs the exact balance to be paid: ${inr(Math.max(0,bal))}.`)
    if(paid>0&&f.mode!=='Cash'&&!f.ref.trim())return setErr(f.mode==='UPI'?'Enter the UPI transaction / UTR number':'Enter the card slip number or last 4 digits')
    if(!confirm(`Finalize the bill for ${pt.name}?\nNet ${inr(net)} · Balance paid now ${inr(paid)}\nThe patient will be marked as discharged and the bill will be locked.`))return
    setBusy(true);const {error}=await supabase.rpc('ipd_finalize',{p_adm:adm.id,p_discount:d,p_authority:f.au==='Other'?f.auO:f.au,p_paid:paid,p_mode:f.mode,p_ref:f.ref,p_status:f.status});setBusy(false);if(error)return setErr(error.message)
    setMsg('Full & Final bill completed. The patient is discharged.');const {data:a}=await supabase.from('admissions').select('*').eq('id',adm.id).single();setAdm(a);await loadBill(a);setShow(true)}
  const data={patient:pt,adm,bills,pays}
  return <div className="space-y-4">
    <div className="card space-y-2 p-4"><form onSubmit={e=>{e.preventDefault();search()}} className="flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder="Patient name, UHID, phone or IPD number" value={q} onChange={e=>setQ(e.target.value)}/></div><button className="btn">Find</button></form>
      {err&&!pt&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}{hits.map(p=><button key={p.id} onClick={()=>pick(p)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-400">{p.uhid} · {p.phone}</span></button>)}</div>
    {!pt&&<p className="p-8 text-center text-sm text-slate-400">Search for a patient to prepare the IPD Consolidated Full &amp; Final Bill. All services, advances and dues are fetched from the patient's account automatically.</p>}
    {pt&&<div className="card flex flex-wrap items-center gap-3 p-4 sm:p-5"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy text-lg font-extrabold text-white">{pt.name[0]}</div>
      <div className="min-w-0 flex-1"><div className="text-lg font-extrabold text-navy">{pt.name} <span className="rounded-lg bg-navy-50 px-2 py-0.5 align-middle text-xs">{pt.uhid}</span></div><div className="text-xs text-slate-500">{pt.age?pt.age+'y · ':''}{pt.sex} · {pt.phone||'no phone'}{pt.father_name&&` · ${pt.relation||'S/O'} ${pt.father_name}`}</div></div><button className="text-slate-400" onClick={()=>{setPt(null);setAdm(null);setBills([])}}><X size={18}/></button></div>}
    {pt&&adms.length===0&&<p className="card p-8 text-center text-sm text-slate-400">This patient has no IPD admission.</p>}
    {pt&&others.length>0&&<div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-800">Other pending dues for this patient (OPD / pharmacy / optical): <b>{inr(others.reduce((s,b)=>s+Number(b.total)-Number(b.paid),0))}</b>. Collect them in Money Receipt.</div>}
    {pt&&adm&&<>
      {adms.length>1&&<div className="card p-4"><label className="lbl">Admission</label><select className="inp" value={adm.id} onChange={e=>setAdm(adms.find(a=>a.id===e.target.value))}>{adms.map(a=><option key={a.id} value={a.id}>{nb(a.adm_no)} · {a.procedure} · {a.status} · {dt(a.admitted_at)}</option>)}</select></div>}
      {missing&&<div className="flex flex-wrap items-end gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><div className="min-w-0 flex-1"><b className="text-amber-900">Admission procedure is not on the bill yet</b><div className="text-xs text-amber-800">{adm.procedure}</div></div>
        <div><label className="lbl">Charge (₹)</label><input className="inp !w-32" type="number" placeholder={procRate!=null?String(procRate):'Enter amount'} value={pr} onChange={e=>setPr(e.target.value)}/></div><button className="btn" disabled={busy} onClick={addProc}>Add to bill</button></div>}
      <div className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3"><b className="text-sm text-navy">{nb(adm.adm_no)} · {adm.procedure} ({adm.side})</b>
        <span className="text-xs text-slate-500">Admitted {dt(adm.admitted_at)}{adm.discharged_at&&` · Discharged ${dt(adm.discharged_at)}`}</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-left text-sm"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-5 py-2">Description</th><th>Category</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="px-5 text-right">Amount</th></tr></thead>
          <tbody>{items.map((x,i)=><tr key={i} className="border-t border-slate-100"><td className="px-5 py-2">{x.d}</td><td className="text-xs text-slate-500">{x.c||'Other'}</td><td className="text-right">{x.q}</td><td className="text-right">{inr(x.r)}</td><td className="px-5 text-right">{inr(x.q*x.r)}</td></tr>)}
            {items.length===0&&<tr><td colSpan="5" className="p-8 text-center text-sm text-slate-400">No services are billed for this admission yet. Add them in Money Receipt → Add IPD service.</td></tr>}</tbody></table></div></div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="card space-y-2 p-5 text-sm"><b className="text-navy">Bill summary</b>
        {[['Total bill',inr(sub)],['Discount already given','- '+inr(disc0)],...(finalised?[]:[['Final discount','- '+inr(d)]]),['Net amount',inr(finalised?total0:net)],['Advance / payments received',inr(got)]].map(([l,v])=><div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><b>{v}</b></div>)}
        <div className={`flex justify-between border-t pt-2 text-lg font-extrabold ${(finalised?total0-got:bal)>0?'text-red-600':'text-emerald-600'}`}><span>Balance</span><span>{inr(finalised?total0-got:bal)}</span></div></div>
        {finalised?<div className="card flex flex-col items-center justify-center gap-3 p-5 text-center"><FileCheck2 className="text-emerald-600" size={36}/><b className="text-navy">Full &amp; Final bill completed</b><span className="text-xs text-slate-500">Status: {adm.discharge_status||'Discharged'}</span>{msg&&<p className="text-xs font-medium text-emerald-700">{msg}</p>}<button className="btn" onClick={()=>setShow(true)}><Printer size={16}/>Print Full &amp; Final bill</button></div>
        :canBill?<div className="card space-y-3 p-5"><b className="text-navy">Finalize &amp; discharge</b>
          <div className="grid grid-cols-2 gap-3"><div><label className="lbl">Final discount (₹)</label><input className="inp" type="number" value={f.disc} onChange={e=>setF({...f,disc:e.target.value})}/></div>
            <div><label className="lbl">Balance paid now (₹)</label><input className="inp" type="number" value={f.paid===''?Math.max(0,bal):f.paid} onChange={e=>setF({...f,paid:e.target.value})}/></div></div>
          {d>0&&<div><label className="lbl">Discount authority *</label><select className="inp" value={f.au} onChange={e=>setF({...f,au:e.target.value})}>{AUTH.map(a=><option key={a}>{a}</option>)}</select>{f.au==='Other'&&<input className="inp mt-2" placeholder="Full name" value={f.auO} onChange={e=>setF({...f,auO:e.target.value})}/>}</div>}
          <div className="grid grid-cols-2 gap-3"><div><label className="lbl">Payment mode</label><select className="inp" value={f.mode} onChange={e=>setF({...f,mode:e.target.value})}><option>Cash</option><option>UPI</option><option>Card</option></select></div>
            <div><label className="lbl">Patient status</label><select className="inp" value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{STATUS.map(s=><option key={s}>{s}</option>)}</select></div></div>
          {f.mode!=='Cash'&&<div><label className="lbl">{f.mode==='UPI'?'UPI Txn / UTR number *':'Card slip no. or last 4 digits *'}</label><input className="inp" value={f.ref} onChange={e=>setF({...f,ref:e.target.value})}/></div>}
          {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
          <button className="btn w-full" disabled={busy} onClick={run}><FileCheck2 size={16}/>{busy?'Finalizing…':'Finalize bill & discharge'}</button>
          <button className="w-full text-xs font-semibold text-accent" onClick={()=>setShow(true)}>Preview bill</button></div>
        :<p className="card p-5 text-sm text-slate-500">Only an Admin can finalize a bill.</p>}</div></>}
    {show&&pt&&adm&&<FinalBill d={data} onClose={()=>setShow(false)}/>}</div>
}
