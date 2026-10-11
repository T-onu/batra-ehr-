import { useEffect, useState } from 'react'
import { Search, Plus, Trash2, Printer, X, Receipt as RI } from 'lucide-react'
import { supabase, inr, today } from '../lib/supabase'
import { words } from '../lib/words'
const PRESETS=['OPD Consultation','Refraction','OCT','Fundus Photo','Visual Field','Biometry','Surgery Package','Medicines','Spectacles']
const KINDS=['OPD','IPD','Pharmacy','Optical','Other']
const sum=i=>i.reduce((a,x)=>a+(+x.q||0)*(+x.r||0),0)
function Receipt({b,onClose}){const bal=b.total-b.paid
  return <div className="fixed inset-0 z-40 overflow-auto bg-slate-900/50 p-4 backdrop-blur-sm"><div className="mx-auto max-w-2xl">
    <div className="no-print mb-3 flex justify-end gap-2"><button className="btn" onClick={()=>window.print()}><Printer size={16}/>Print / PDF</button><button className="btn !bg-white !text-navy" onClick={onClose}><X size={16}/>Close</button></div>
    <div className="print-area card space-y-4 p-8 text-sm">
      <div className="flex items-center gap-4 border-b-2 border-navy pb-4"><img src="/logo.png" width="64" height="64" className="rounded-full" alt=""/>
        <div className="flex-1"><div className="text-2xl font-extrabold text-navy">Batra Eye Hospital</div><div className="text-xs text-slate-500">Mukerian · Emergency: 8295954631 / 8427808384</div></div>
        <div className="text-right text-xs"><b className="text-base text-navy">RECEIPT</b><div>{b.bill_no}</div><div>{b.bill_date}</div></div></div>
      <div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-slate-400">Patient</span><br/><b className="text-sm">{b.patients?.name}</b></div>
        <div className="text-right"><span className="text-slate-400">UHID</span><br/><b className="text-sm">{b.patients?.uhid}</b></div></div>
      <table className="w-full text-left text-xs"><thead><tr className="border-y border-slate-300 bg-slate-50"><th className="p-2">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th></tr></thead>
        <tbody>{b.items.map((x,i)=><tr key={i} className="border-b border-slate-100"><td className="p-2">{x.d}</td><td className="p-2 text-right">{x.q}</td><td className="p-2 text-right">{inr(x.r)}</td><td className="p-2 text-right">{inr(x.q*x.r)}</td></tr>)}</tbody></table>
      <div className="ml-auto w-60 space-y-1 text-xs"><div className="flex justify-between"><span>Subtotal</span><span>{inr(b.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>- {inr(b.discount)}</span></div>
        <div className="flex justify-between border-t pt-1 text-sm font-bold"><span>Total</span><span>{inr(b.total)}</span></div><div className="flex justify-between"><span>Paid</span><span>{inr(b.paid)}</span></div>
        <div className={`flex justify-between font-bold ${bal>0?'text-red-600':'text-emerald-600'}`}><span>Balance due</span><span>{inr(bal)}</span></div></div>
      <p className="text-xs"><b>Amount in words:</b> {words(b.total)}</p>
      <div className="flex justify-between pt-8 text-[10px] text-slate-400"><span>Computer generated receipt · Mode: {b.mode}</span><span>Authorised signatory</span></div></div></div></div>}

export default function Billing(){
  const [tab,setTab]=useState('new'),[q,setQ]=useState(''),[res,setRes]=useState([]),[pt,setPt]=useState(null),[items,setItems]=useState([{d:'',q:1,r:''}]),
    [disc,setDisc]=useState(''),[pay,setPay]=useState(''),[mode,setMode]=useState('Cash'),[kind,setKind]=useState('OPD'),[err,setErr]=useState(''),[busy,setBusy]=useState(false),
    [show,setShow]=useState(null),[date,setDate]=useState(today()),[list,setList]=useState([]),[due,setDue]=useState({})
  useEffect(()=>{if(!q.trim()){setRes([]);return};const t=setTimeout(async()=>{const {data}=await supabase.from('patients').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%,uhid.ilike.%${q}%`).limit(6);setRes(data||[])},250);return()=>clearTimeout(t)},[q])
  const loadList=async()=>{const {data}=await supabase.from('bills').select('*, patients(name,uhid)').eq('bill_date',date).order('created_at',{ascending:false});setList(data||[])}
  useEffect(()=>{if(tab==='list')loadList()},[tab,date])
  const sub=sum(items),total=Math.max(0,sub-(+disc||0)),upd=(i,k,v)=>setItems(items.map((x,j)=>j===i?{...x,[k]:v}:x))
  const save=async()=>{setErr('');const clean=items.filter(x=>x.d.trim()&&+x.r>0).map(x=>({d:x.d.trim(),q:+x.q||1,r:+x.r}))
    if(!pt)return setErr('Pehle patient select karo');if(!clean.length)return setErr('Kam se kam ek item (naam + rate) daalo')
    if((+pay||0)>total)return setErr('Paid amount total se zyada nahi ho sakta');setBusy(true)
    const {data:b,error}=await supabase.from('bills').insert({patient_id:pt.id,kind,items:clean,subtotal:sum(clean),discount:+disc||0,total:Math.max(0,sum(clean)-(+disc||0)),mode}).select('*, patients(name,uhid)').single()
    if(error){setBusy(false);return setErr(error.message)}
    if(+pay>0){const {error:e2}=await supabase.from('payments').insert({bill_id:b.id,amount:+pay,mode});if(e2){setBusy(false);return setErr(e2.message)};b.paid=+pay}
    setBusy(false);setShow(b);setPt(null);setQ('');setItems([{d:'',q:1,r:''}]);setDisc('');setPay('')}
  const collect=async b=>{const amt=+due[b.id];if(!amt||amt<=0||amt>b.total-b.paid)return alert('Sahi amount daalo (due se zyada nahi)')
    const {error}=await supabase.from('payments').insert({bill_id:b.id,amount:amt,mode:'Cash'});if(error)return alert(error.message);setDue({...due,[b.id]:''});loadList()}
  return <div className="space-y-4">
    <div className="flex gap-2">{[['new','New bill'],['list','Bills & dues']].map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab===k?'bg-navy text-white':'bg-white text-slate-500'}`}>{l}</button>)}</div>
    {tab==='new'?<div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="space-y-4">
      <div className="card space-y-3 p-5"><label className="lbl">Patient</label>
        {pt?<div className="flex items-center justify-between rounded-xl bg-navy-50 p-3"><div><b>{pt.name}</b><div className="text-xs text-slate-500">{pt.uhid} · {pt.phone}</div></div><button onClick={()=>setPt(null)}><X size={16}/></button></div>
        :<><div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder="Name / phone / UHID" value={q} onChange={e=>setQ(e.target.value)}/></div>
          {res.map(p=><button key={p.id} onClick={()=>setPt(p)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-400">{p.uhid} · {p.phone}</span></button>)}</>}</div>
      <div className="card space-y-3 p-5"><div className="flex flex-wrap gap-1.5">{PRESETS.map(p=><button key={p} onClick={()=>setItems([...items.filter(x=>x.d||x.r),{d:p,q:1,r:''}])} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:border-accent hover:text-accent">+ {p}</button>)}</div>
        {items.map((x,i)=><div key={i} className="grid grid-cols-[1fr_56px_92px_28px] gap-2"><input className="inp" placeholder="Item" value={x.d} onChange={e=>upd(i,'d',e.target.value)}/><input className="inp !px-2 text-center" type="number" min="1" value={x.q} onChange={e=>upd(i,'q',e.target.value)}/>
          <input className="inp !px-2" type="number" placeholder="Rate" value={x.r} onChange={e=>upd(i,'r',e.target.value)}/><button onClick={()=>setItems(items.length>1?items.filter((_,j)=>j!==i):items)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div>)}
        <button className="text-xs font-semibold text-accent" onClick={()=>setItems([...items,{d:'',q:1,r:''}])}><Plus size={12} className="inline"/> Add row</button></div></div>
      <div className="card h-fit space-y-3 p-5"><div><label className="lbl">Bill type</label><select className="inp" value={kind} onChange={e=>setKind(e.target.value)}>{KINDS.map(k=><option key={k}>{k}</option>)}</select></div>
        <div className="flex justify-between text-sm"><span>Subtotal</span><b>{inr(sub)}</b></div>
        <div><label className="lbl">Discount (₹)</label><input className="inp" type="number" value={disc} onChange={e=>setDisc(e.target.value)}/></div>
        <div className="flex justify-between border-t pt-3 text-lg font-extrabold text-navy"><span>Total</span><span>{inr(total)}</span></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="lbl">Pay now (₹)</label><input className="inp" type="number" value={pay} onChange={e=>setPay(e.target.value)}/></div>
          <div><label className="lbl">Mode</label><select className="inp" value={mode} onChange={e=>setMode(e.target.value)}><option>Cash</option><option>UPI</option><option>Card</option></select></div></div>
        <div className="text-xs text-slate-500">Balance: <b className={total-(+pay||0)>0?'text-red-600':'text-emerald-600'}>{inr(total-(+pay||0))}</b></div>
        {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}<button className="btn w-full" disabled={busy} onClick={save}><RI size={16}/>{busy?'Saving…':'Generate receipt'}</button></div></div>
    :<div className="space-y-3"><div className="flex items-center gap-3"><input type="date" className="inp max-w-[200px]" value={date} onChange={e=>setDate(e.target.value)}/>
      <span className="text-xs text-slate-500">Collected: <b className="text-navy">{inr(list.reduce((a,x)=>a+Number(x.paid),0))}</b> · Due: <b className="text-red-600">{inr(list.reduce((a,x)=>a+Number(x.total)-Number(x.paid),0))}</b></span></div>
      <div className="card divide-y divide-slate-100">{list.length===0&&<p className="p-10 text-center text-sm text-slate-400">Is din koi bill nahi.</p>}
        {list.map(b=>{const bal=b.total-b.paid;return <div key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
          <button onClick={()=>setShow(b)} className="min-w-0 flex-1 text-left"><b>{b.patients?.name}</b><div className="text-xs text-slate-400">{b.bill_no} · {b.kind} · {inr(b.total)}</div></button>
          {bal>0?<><span className="text-xs font-bold text-red-600">Due {inr(bal)}</span><input className="inp !w-24 !py-1.5" type="number" placeholder="₹" value={due[b.id]||''} onChange={e=>setDue({...due,[b.id]:e.target.value})}/><button className="btn !py-1.5 !text-xs" onClick={()=>collect(b)}>Collect</button></>
          :<span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">PAID</span>}</div>})}</div></div>}
    {show&&<Receipt b={show} onClose={()=>setShow(null)}/>}</div>
}
