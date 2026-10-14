import { Printer, X } from 'lucide-react'
import { inr } from '../lib/supabase'
import { words } from '../lib/words'
export default function Receipt({b,onClose}){const bal=b.total-b.paid
  return <div className="fixed inset-0 z-40 overflow-auto bg-slate-900/50 p-4 backdrop-blur-sm"><div className="mx-auto max-w-2xl">
    <div className="no-print mb-3 flex justify-end gap-2"><button className="btn" onClick={()=>window.print()}><Printer size={16}/>Print / PDF</button><button className="btn !bg-white !text-navy" onClick={onClose}><X size={16}/>Close</button></div>
    <div className="print-area card space-y-4 p-8 text-sm">
      <div className="flex items-center gap-4 border-b-2 border-navy pb-4"><img src="/logo.png" width="64" height="64" className="rounded-full" alt=""/>
        <div className="flex-1"><div className="text-2xl font-extrabold text-navy">Batra Eye Hospital</div><div className="text-xs text-slate-500">Mukerian · Emergency: 8295954631 / 8427808384</div></div>
        <div className="text-right text-xs"><b className="text-base text-navy">RECEIPT</b><div>{b.bill_no}</div><div>{b.bill_date}</div></div></div>
      {b.status==='Cancelled'&&<div className="rounded-lg border-2 border-red-500 py-1 text-center text-lg font-extrabold tracking-widest text-red-600">CANCELLED</div>}
      <div className="grid grid-cols-2 gap-2 text-xs"><div><span className="text-slate-400">Patient</span><br/><b className="text-sm">{b.patients?.name}</b></div>
        <div className="text-right"><span className="text-slate-400">UHID</span><br/><b className="text-sm">{b.patients?.uhid}</b></div></div>
      <table className="w-full text-left text-xs"><thead><tr className="border-y border-slate-300 bg-slate-50"><th className="p-2">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Amount</th></tr></thead>
        <tbody>{b.items.map((x,i)=><tr key={i} className="border-b border-slate-100"><td className="p-2">{x.d}</td><td className="p-2 text-right">{x.q}</td><td className="p-2 text-right">{inr(x.r)}</td><td className="p-2 text-right">{inr(x.q*x.r)}</td></tr>)}</tbody></table>
      <div className="ml-auto w-60 space-y-1 text-xs"><div className="flex justify-between"><span>Subtotal</span><span>{inr(b.subtotal)}</span></div><div className="flex justify-between"><span>Discount</span><span>- {inr(b.discount)}</span></div>{b.returned>0&&<div className="flex justify-between"><span>Returns</span><span>- {inr(b.returned)}</span></div>}
        <div className="flex justify-between border-t pt-1 text-sm font-bold"><span>Total</span><span>{inr(b.total)}</span></div><div className="flex justify-between"><span>Paid</span><span>{inr(b.paid)}</span></div>
        <div className={`flex justify-between font-bold ${bal>0?'text-red-600':'text-emerald-600'}`}><span>Balance due</span><span>{inr(bal)}</span></div></div>
      <p className="text-xs"><b>Amount in words:</b> {words(b.total)}</p>
      <div className="flex justify-between pt-8 text-[10px] text-slate-400"><span>Computer generated receipt · Mode: {b.mode}</span><span>Authorised signatory</span></div></div></div></div>}

