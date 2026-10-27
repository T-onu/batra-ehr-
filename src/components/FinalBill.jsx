import { Printer, X } from 'lucide-react'
import { inr } from '../lib/supabase'
import { words } from '../lib/words'
const dtm = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—'
const dd = d => d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : '—'
const tm = d => d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : '—'
const Row = ({ l, v, b, c }) => <div className={`flex justify-between ${b ? 'border-t border-slate-400 pt-1 text-sm font-bold' : ''} ${c || ''}`}><span>{l}</span><span>{v}</span></div>
// IPD Consolidated Full & Final Bill. d = {patient, adm, bills[], pays[]}
export default function FinalBill({ d, onClose }) {
  const { patient: p, adm: a, bills, pays } = d, act = bills.filter(b => b.status === 'Active'), items = act.flatMap(b => b.items || []), first = act[0] || {}
  const sub = act.reduce((s, b) => s + Number(b.subtotal), 0), disc = act.reduce((s, b) => s + Number(b.discount), 0), net = act.reduce((s, b) => s + Number(b.total), 0)
  const ids = new Set(act.map(b => b.id)), live = pays.filter(x => ids.has(x.bill_id) && !x.cancelled_at)
  const adv = live.filter(x => !x.is_final && x.amount > 0), fin = live.filter(x => x.is_final), refunds = live.filter(x => !x.is_final && x.amount < 0)
  const advT = adv.reduce((s, x) => s + Number(x.amount), 0), finT = fin.reduce((s, x) => s + Number(x.amount), 0), refT = refunds.reduce((s, x) => s - Number(x.amount), 0), bal = net - (advT + finT - refT)
  const cat = c => items.filter(x => (x.c || 'Other') === c).reduce((s, x) => s + x.q * x.r, 0)
  const fr = fin[0] || [...adv].reverse().find(x => x.receipt_no), finalised = !!first.finalized_at
  return <div className="fixed inset-0 z-40 overflow-auto bg-slate-900/50 p-4 backdrop-blur-sm"><div className="mx-auto max-w-3xl">
    <div className="no-print mb-3 flex justify-end gap-2"><button className="btn" onClick={() => window.print()}><Printer size={16} />Print / PDF</button><button className="btn !bg-white !text-navy" onClick={onClose}><X size={16} />Close</button></div>
    <div className="print-area card space-y-3 p-6 text-[12px] sm:p-8">
      <div className="flex items-center gap-4 border-b-2 border-navy pb-3"><img src="/logo.png" width="60" height="60" className="rounded-full" alt="" />
        <div className="flex-1"><div className="text-2xl font-extrabold text-navy">Batra Eye Hospital</div><div className="text-[11px] text-slate-500">Mukerian, Bhangala Chungi · Phone: 8295954631 / 8427808384 · akhilbatra073@gmail.com</div></div></div>
      <div className="text-center text-sm font-extrabold tracking-wide text-navy">IPD CONSOLIDATED FULL &amp; FINAL BILL</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-slate-300 p-3">
        <div>Receipt No: <b>{fr?.receipt_no || '—'}</b></div><div className="text-right">UHID: <b>{p.uhid}</b></div>
        <div>Patient: <b>{p.name}</b></div><div className="text-right">IPD No: <b>{(a.adm_no || '').replace(/^BEH-?/, '')}</b></div>
        <div>{p.relation || 'S/O'}: <b>{p.father_name || '—'}</b></div><div className="text-right">Age / Sex: <b>{p.age ? p.age + ' Y' : '—'} / {p.sex}</b></div>
        <div>Mobile: <b>{p.phone || '—'}</b></div><div className="text-right">Procedure: <b>{a.procedure}{a.side ? ` (${a.side})` : ''}</b></div>
        <div>Created by: <b>{first.issued_by || '—'}</b></div><div className="text-right">Date / Time: <b>{dd(first.created_at)} {tm(first.created_at)}</b></div></div>
      <table className="w-full text-left"><thead><tr className="border-y border-slate-400 bg-slate-50"><th className="p-1.5">Description</th><th className="p-1.5 text-right">Qty</th><th className="p-1.5 text-right">Rate</th><th className="p-1.5 text-right">Amount</th></tr></thead>
        <tbody>{items.map((x, i) => <tr key={i} className="border-b border-slate-100"><td className="p-1.5">{x.d}</td><td className="p-1.5 text-right">{x.q}</td><td className="p-1.5 text-right">{inr(x.r)}</td><td className="p-1.5 text-right">{inr(x.q * x.r)}</td></tr>)}{items.length === 0 && <tr><td colSpan="4" className="p-3 text-center text-slate-400">No services billed.</td></tr>}</tbody></table>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1">
        <div className="font-bold text-navy">Payment details</div>
        {adv.map(x => <div key={x.id} className="flex justify-between text-[11px]"><span>{x.receipt_no} · {dd(x.created_at)} · {x.mode}{x.txn_ref ? ` (${x.txn_ref})` : ''}</span><span>{inr(x.amount)}</span></div>)}
        {refunds.map(x => <div key={x.id} className="flex justify-between text-[11px] text-red-600"><span>{x.receipt_no} · Refund</span><span>- {inr(-x.amount)}</span></div>)}
        {fin.map(x => <div key={x.id} className="flex justify-between text-[11px]"><span>{x.receipt_no} · Final · {x.mode}{x.txn_ref ? ` · Txn/UTR ${x.txn_ref}` : ''}</span><span>{inr(x.amount)}</span></div>)}
        {adv.length + fin.length === 0 && <div className="text-[11px] text-slate-400">No payments recorded.</div>}</div>
        <div className="space-y-1"><Row l="Procedure charges" v={inr(cat('Procedure'))} /><Row l="Investigation charges" v={inr(cat('Investigation'))} /><Row l="Other charges" v={inr(cat('Other'))} />
          <Row l="Total bill" v={inr(sub)} b /><Row l="Less: discount" v={`- ${inr(disc)}`} /><Row l="Net amount" v={inr(net)} b /><Row l="Advance already received" v={inr(advT - refT)} />{finT > 0 && <Row l="Final payment" v={inr(finT)} />}
          <Row l="Balance" v={inr(bal)} b c={bal > 0 ? 'text-red-600' : 'text-emerald-700'} /></div></div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 p-3">
        <div>Patient status: <b>{a.discharge_status || (a.status === 'Admitted' ? 'Admitted' : '—')}</b></div><div className="text-right">Finalized by: <b>{first.finalized_by || '—'}</b></div>
        <div>Admission: <b>{dtm(a.admitted_at)}</b></div><div className="text-right">Discharge: <b>{dtm(a.discharged_at)}</b></div>
        <div className="col-span-2">Full &amp; Final settlement: <b>{finalised ? dtm(first.finalized_at) : 'Not finalized yet'}</b></div></div>
      {finalised && <div className="rounded-lg border-2 border-navy py-2 text-center text-sm font-extrabold text-navy">AMOUNT PAID {inr(advT - refT + finT)} · FULL &amp; FINAL</div>}
      <p><b>Amount in words:</b> {words(Math.max(0, advT - refT + finT))}</p>
      <div className="flex justify-between pt-8 text-[10px] text-slate-500"><span>Computer generated bill{first.issued_by && <><br />Issued by: {first.issued_by}</>}</span><span className="border-t border-slate-400 px-6 pt-1">Authorised signatory</span></div></div></div></div>
}