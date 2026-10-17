import { useEffect, useState } from 'react'
import { Search, Trash2, Plus } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
import Receipt from '../components/Receipt'
import PatientPick from '../components/PatientPick'
const AUTH=['Dr. Akhil Batra','Dr. Sunanda','Other']
export default function Investigations({profile}){
  const role=profile?.role,canBill=['Reception','Billing','Admin','Super Admin'].includes(role),canDo=['Doctor','Reception','Admin','Super Admin'].includes(role),isAdm=['Admin','Super Admin'].includes(role)
  const [tab,setTab]=useState(canBill?'new':'orders'),[cat,setCat]=useState([]),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[rcpt,setRcpt]=useState(null)
  const loadCat=async()=>{const {data}=await supabase.from('catalog_items').select('*').eq('active',true).order('name');setCat(data||[])}
  useEffect(()=>{loadCat()},[])
  // new order
  const [pt,setPt]=useState(null),[ctx,setCtx]=useState('OPD'),[adms,setAdms]=useState([]),[adm,setAdm]=useState(''),[lines,setLines]=useState([]),[q,setQ]=useState(''),[cust,setCust]=useState(''),[disc,setDisc]=useState(''),[au,setAu]=useState(AUTH[0]),[auO,setAuO]=useState(''),[paid,setPaid]=useState(''),[mode,setMode]=useState('Cash')
  useEffect(()=>{setAdm('');setAdms([]);if(pt&&ctx==='IPD')supabase.from('admissions').select('id,adm_no,procedure,status').eq('patient_id',pt.id).in('status',['Admitted','Discharged']).order('created_at',{ascending:false}).then(({data})=>setAdms(data||[]))},[pt,ctx])
  const kind=ctx==='OPD'?'opd_investigation':'ipd_procedure',hits=q.trim()?cat.filter(c=>c.kind===kind&&c.name.toLowerCase().includes(q.toLowerCase())).slice(0,8):[]
  const sub=lines.reduce((a,l)=>a+(+l.charge||0),0),tot=Math.max(0,sub-(+disc||0)),setL=(i,v)=>setLines(lines.map((l,j)=>j===i?{...l,charge:v}:l))
  const add=(name,category)=>{if(!lines.find(l=>l.name===name))setLines([...lines,{name,category,charge:''}]);setQ('');setCust('')}
  const submit=async()=>{setErr('');if(!pt)return setErr('Select a patient');setBusy(true)
    const {data:id,error}=await supabase.rpc('order_investigations',{p_patient:pt.id,p_ctx:ctx,p_adm:ctx==='IPD'?adm||null:null,p_items:lines.map(l=>({name:l.name,category:l.category,charge:l.charge===''?null:+l.charge})),p_discount:+disc||0,p_authority:au==='Other'?auO:au,p_paid:+paid||0,p_mode:mode})
    setBusy(false);if(error)return setErr(error.message)
    const {data:b}=await supabase.from('bills').select('*, patients(name,uhid)').eq('id',id).single();setRcpt(b);setPt(null);setLines([]);setDisc('');setPaid('');loadOrders()}
  // orders
  const [orders,setOrders]=useState([]),[st,setSt]=useState('Ordered'),[os,setOs]=useState('')
  const loadOrders=async()=>{const {data}=await supabase.from('investigations').select('*, patients(name,uhid)').order('created_at',{ascending:false}).limit(300);setOrders(data||[])}
  useEffect(()=>{loadOrders()},[])
  const done=async o=>{const r=prompt(`${o.name}\nResult / findings (optional):`,o.result||'');if(r===null)return
    const {error}=await supabase.from('investigations').update({status:'Done',result:r.trim()||null,done_at:new Date().toISOString(),done_by:profile.id}).eq('id',o.id);if(error)alert(error.message);else loadOrders()}
  const shown=orders.filter(o=>(st==='All'||o.status===st)&&(!os.trim()||(o.patients?.name+o.name+o.patients?.uhid).toLowerCase().includes(os.toLowerCase())))
  // master
  const [mk,setMk]=useState('opd_investigation'),[mn,setMn]=useState(''),[mq,setMq]=useState('')
  const addCat=async()=>{if(!mn.trim())return;const {error}=await supabase.from('catalog_items').insert({kind:mk,name:mn.trim(),category:mk==='opd_investigation'?'Ophthalmology Investigation':'Ophthalmology Procedure'});if(error)alert(error.message);else{setMn('');loadCat()}}
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{[['new','New order'],['orders','Orders & results'],['master','Master list']].map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab===k?'bg-navy text-white':'bg-white text-slate-500'}`}>{l}</button>)}</div>
    {tab==='new'&&<div className="grid gap-4 lg:grid-cols-[1fr_320px]">{!canBill&&<p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700 lg:col-span-2">Your role cannot create investigation bills (Reception, Billing and Admin can).</p>}
      <div className="space-y-4"><div className="card space-y-3 p-5"><PatientPick pt={pt} setPt={setPt}/>
        <div className="flex gap-2">{[['OPD','OPD investigation'],['IPD','IPD procedure']].map(([k,l])=><button key={k} onClick={()=>{setCtx(k);setLines([])}} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${ctx===k?'border-accent bg-accent text-white':'border-slate-200 text-slate-500'}`}>{l}</button>)}</div>
        {ctx==='IPD'&&<select className="inp" value={adm} onChange={e=>setAdm(e.target.value)}><option value="">{pt?'Select an admission…':'Select a patient first'}</option>{adms.map(a=><option key={a.id} value={a.id}>{a.adm_no} · {a.procedure} ({a.status})</option>)}</select>}</div>
        <div className="card space-y-3 p-5"><div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder={ctx==='OPD'?'Investigation search (OCT, NCT, Gonioscopy…)':'Procedure search (Pterygium, Vitrectomy…)'} value={q} onChange={e=>setQ(e.target.value)}/></div>
          {hits.map(c=><button key={c.id} onClick={()=>add(c.name,c.category)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">{c.name}</button>)}
          <div className="flex gap-2"><input className="inp" placeholder="Custom item (if not in the list)" value={cust} onChange={e=>setCust(e.target.value)}/><button className="btn !px-3" onClick={()=>cust.trim()&&add(cust.trim(),'Custom')}><Plus size={16}/></button></div>
          {lines.map((l,i)=><div key={l.name} className="grid grid-cols-[1fr_96px_24px] items-center gap-2 text-sm"><span>{l.name}</span><input className="inp !px-2" type="number" placeholder="Charge ₹" value={l.charge} onChange={e=>setL(i,e.target.value)}/><button onClick={()=>setLines(lines.filter((_,j)=>j!==i))} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button></div>)}
          {lines.length===0&&<p className="text-xs text-slate-400">Search and add items, then enter a charge for each.</p>}</div></div>
      <div className="card h-fit space-y-3 p-5"><div className="flex justify-between text-sm"><span>Subtotal</span><b>{inr(sub)}</b></div><div><label className="lbl">Discount (₹)</label><input className="inp" type="number" value={disc} onChange={e=>setDisc(e.target.value)}/></div>
        {+disc>0&&<div><label className="lbl">Discount authority *</label><select className="inp" value={au} onChange={e=>setAu(e.target.value)}>{AUTH.map(a=><option key={a}>{a}</option>)}</select>{au==='Other'&&<input className="inp mt-2" placeholder="Full name" value={auO} onChange={e=>setAuO(e.target.value)}/>}</div>}
        <div className="flex justify-between border-t pt-3 text-lg font-extrabold text-navy"><span>Total</span><span>{inr(tot)}</span></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="lbl">Paid (₹)</label><input className="inp" type="number" value={paid} onChange={e=>setPaid(e.target.value)}/></div><div><label className="lbl">Mode</label><select className="inp" value={mode} onChange={e=>setMode(e.target.value)}><option>Cash</option><option>UPI</option><option>Card</option></select></div></div>
        {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}<button className="btn w-full" disabled={busy||!canBill} onClick={submit}>{busy?'Saving…':'Generate receipt'}</button></div></div>}
    {tab==='orders'&&<div className="space-y-3"><div className="flex gap-3"><select className="inp max-w-[160px]" value={st} onChange={e=>setSt(e.target.value)}><option>Ordered</option><option>Done</option><option>All</option></select><input className="inp" placeholder="Patient / UHID / investigation" value={os} onChange={e=>setOs(e.target.value)}/></div>
      <div className="card divide-y divide-slate-100">{shown.length===0&&<p className="p-10 text-center text-sm text-slate-400">No orders found.</p>}
        {shown.map(o=><div key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm"><div className="min-w-0 flex-1"><b>{o.patients?.name}</b> <span className="text-xs text-slate-400">{o.patients?.uhid} · {o.context} · {new Date(o.created_at).toLocaleDateString('en-GB')}</span><div className="text-xs text-slate-600">{o.name}</div>{o.result&&<div className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{o.result}</div>}</div>
          {o.status==='Ordered'?<>{canDo&&<button className="btn !py-1.5 !text-xs" onClick={()=>done(o)}>Mark done</button>}<span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">ORDERED</span></>:<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">DONE</span>}</div>)}</div></div>}
    {tab==='master'&&<div className="space-y-3">{isAdm&&<div className="card flex flex-wrap items-end gap-3 p-5"><div><label className="lbl">Type</label><select className="inp" value={mk} onChange={e=>setMk(e.target.value)}><option value="opd_investigation">OPD investigation</option><option value="ipd_procedure">IPD procedure</option></select></div>
      <div className="min-w-[220px] flex-1"><label className="lbl">New item</label><input className="inp" value={mn} onChange={e=>setMn(e.target.value)}/></div><button className="btn" onClick={addCat}><Plus size={16}/>Add</button></div>}
      <input className="inp" placeholder="Search master list" value={mq} onChange={e=>setMq(e.target.value)}/>
      {[['opd_investigation','OPD investigations'],['ipd_procedure','IPD procedures']].map(([k,l])=>{const r=cat.filter(c=>c.kind===k&&(!mq.trim()||c.name.toLowerCase().includes(mq.toLowerCase())));return <div key={k} className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-3 font-bold text-navy">{l} <span className="text-xs font-medium text-slate-400">({r.length})</span></div><div className="max-h-80 divide-y divide-slate-100 overflow-auto">{r.map(c=><div key={c.id} className="px-5 py-2 text-sm">{c.name}</div>)}</div></div>})}</div>}
    {rcpt&&<Receipt b={rcpt} onClose={()=>setRcpt(null)}/>}</div>
}
