import { useEffect, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
import { words } from '../lib/words'
const dt=d=>d?new Date(d).toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'}):''
const Head=({b,title})=><div className="flex items-center gap-3 border-b-2 border-navy pb-2"><img src="/logo.png" width="52" height="52" className="rounded-full" alt=""/>
  <div className="min-w-0 flex-1"><div className="text-xl font-extrabold leading-tight text-navy">Batra Eye Hospital</div><div className="text-[10px] leading-snug text-slate-500">Mukerian, Bhangala Chungi · 8295954631 / 8427808384<br/>akhilbatra073@gmail.com</div></div>
  <div className="text-right text-[11px]"><b className="text-sm text-navy">{title}</b><div>{b.bill_no}</div><div>{b.bill_date}</div></div></div>
const Body=({b,p,pays,copy})=>{const bal=b.total-b.paid,v=b.visits,mode=[...new Set(pays.filter(x=>!x.cancelled_at&&x.amount>0).map(x=>x.mode))].join(', ')||b.mode,refs=pays.filter(x=>x.txn_ref&&!x.cancelled_at).map(x=>x.txn_ref).join(', ')
  return <div className="space-y-2 text-[11px]">
    {copy&&<div className="text-right text-[9px] font-bold uppercase tracking-widest text-slate-400">{copy}</div>}
    {b.status==='Cancelled'&&<div className="rounded border-2 border-red-500 py-0.5 text-center text-base font-extrabold tracking-widest text-red-600">CANCELLED</div>}
    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-lg border border-slate-300 p-2"><div>Patient: <b>{p?.name}</b></div><div className="text-right">UHID: <b>{p?.uhid}</b></div>
      {p?.father_name&&<div>{p.relation||'S/O'}: <b>{p.father_name}</b></div>}<div className={p?.father_name?'text-right':''}>Age / Sex: <b>{p?.age?p.age+' Y':'—'} / {p?.sex}</b></div>
      {p?.phone&&<div>Mobile: <b>{p.phone}</b></div>}{(v?.visit_no||b.admissions?.adm_no)&&<div className="text-right">{v?.visit_no?'OPD No':'IPD No'}: <b>{(v?.visit_no||b.admissions?.adm_no||'').replace(/^BEH-?/,'')}</b></div>}
      {v?.consultant&&<div className="col-span-2">Consultant: <b>{v.consultant}</b></div>}</div>
    <table className="w-full text-left"><thead><tr className="border-y border-slate-300 bg-slate-50"><th className="p-1">Description</th><th className="p-1 text-right">Qty</th><th className="p-1 text-right">Rate</th><th className="p-1 text-right">Amount</th></tr></thead>
      <tbody>{b.items.map((x,i)=><tr key={i} className="border-b border-slate-100"><td className="p-1">{x.d}</td><td className="p-1 text-right">{x.q}</td><td className="p-1 text-right">{inr(x.r)}</td><td className="p-1 text-right">{inr(x.q*x.r)}</td></tr>)}</tbody></table>
    <div className="flex justify-between gap-4"><div className="space-y-0.5 text-[10px] text-slate-600"><div>Payment mode: <b>{mode}</b></div>{refs&&<div>Txn / Ref: <b>{refs}</b></div>}<div>Amount in words: <b>{words(b.paid)}</b></div></div>
      <div className="w-48 shrink-0 space-y-0.5"><div className="flex justify-between"><span>Subtotal</span><span>{inr(b.subtotal)}</span></div>{b.discount>0&&<div className="flex justify-between"><span>Discount</span><span>- {inr(b.discount)}</span></div>}{b.returned>0&&<div className="flex justify-between"><span>Returns</span><span>- {inr(b.returned)}</span></div>}
        <div className="flex justify-between border-t pt-0.5 text-xs font-bold"><span>Total</span><span>{inr(b.total)}</span></div><div className="flex justify-between"><span>Paid</span><span>{inr(b.paid)}</span></div>
        <div className={`flex justify-between font-bold ${bal>0?'text-red-600':'text-emerald-600'}`}><span>{bal<0?'Advance (credit)':'Balance due'}</span><span>{inr(Math.abs(bal))}</span></div></div></div>
    <div className="flex items-end justify-between pt-3 text-[9px] text-slate-500"><span>Computer generated receipt · {dt(b.created_at)}<br/>Created by: {b.issued_by||'—'}</span><span className="border-t border-slate-400 px-5 pt-0.5">Authorised signatory</span></div></div>}
// OPD receipts print on A4 half page with two copies on one sheet; other bills print as a normal full page.
export default function Receipt({b:b0,onClose}){
  const [b,setB]=useState(b0),[pays,setPays]=useState([])
  useEffect(()=>{(async()=>{if(!b0?.id)return
    const {data}=await supabase.from('bills').select('*, patients(*), visits(visit_no,consultant), admissions(adm_no)').eq('id',b0.id).maybeSingle();if(data)setB({...b0,...data})
    const {data:pm}=await supabase.from('payments').select('*').eq('bill_id',b0.id).order('created_at');setPays(pm||[])})()},[b0?.id])
  const opd=b.kind==='OPD',title=b.kind==='IPD'?'IPD BILL':'RECEIPT',p=b.patients
  return <div className="fixed inset-0 z-40 overflow-auto bg-slate-900/50 p-4 backdrop-blur-sm"><div className="mx-auto max-w-2xl">
    <div className="no-print mb-3 flex items-center justify-end gap-2">{opd&&<span className="mr-auto rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-600">Prints on A4: 2 copies on one page</span>}<button className="btn" onClick={()=>window.print()}><Printer size={16}/>Print / PDF</button><button className="btn !bg-white !text-navy" onClick={onClose}><X size={16}/>Close</button></div>
    {opd?<div className="print-area opd-sheet card divide-y-2 divide-dashed divide-slate-300 bg-white">{['Patient copy','Hospital copy'].map(c=><div key={c} className="opd-half space-y-2 p-5"><Head b={b} title={title}/><Body b={b} p={p} pays={pays} copy={c}/></div>)}</div>
    :<div className="print-area card space-y-3 p-8"><Head b={b} title={title}/><Body b={b} p={p} pays={pays}/></div>}</div></div>}
