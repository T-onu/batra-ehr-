import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase, inr, today } from '../lib/supabase'
const n = x => Number(x || 0)
const D = [['opd', 'Reception (OPD)'], ['inv', 'Investigation / Procedure'], ['ipd', 'IPD'], ['opt', 'Optical'], ['ph', 'Pharmacy'], ['oth', 'Other']]
export default function Reports() {
  const m = today().slice(0, 8) + '01', [from, setFrom] = useState(m), [to, setTo] = useState(today()), [r, setR] = useState(null), [err, setErr] = useState('')
  const load = async () => {
    setErr(''); setR(null); if (to < from) { setErr('The "To" date cannot be before the "From" date.'); return }
    const { data, error } = await supabase.rpc('report_summary', { p_from: from, p_to: to }); if (error) setErr(error.message); else setR(data)
  }
  useEffect(() => { load() }, [from, to])
  const csv = () => {
    const rows = [['Date', ...D.map(x => x[1]), 'Total collection'], ...r.days.map(x => [x.d, ...D.map(([k]) => x.dept[k]), x.col]), [], ['Total', ...D.map(([k]) => r.by_dept[k].total), r.collected]]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(x => x.join(',')).join('\n')], { type: 'text/csv' })); a.download = `report_${from}_to_${to}.csv`; a.click()
  }
  const S = ({ l, v, c, h }) => <div className="card p-5"><div className={`text-2xl font-extrabold ${c || 'text-navy'}`}>{v}</div><div className="text-xs font-medium text-slate-500">{l}</div>{h && <div className="mt-1 text-[11px] text-slate-400">{h}</div>}</div>
  const H = ({ t, s }) => <div className="mb-3"><h3 className="font-extrabold text-navy">{t}</h3>{s && <p className="text-[11px] text-slate-500">{s}</p>}</div>
  const Row = ({ l, v, b }) => <div className={`flex justify-between py-1.5 text-sm ${b ? 'border-t-2 border-navy font-extrabold text-navy' : 'border-b border-slate-100'}`}><span>{l}</span><span>{v}</span></div>
  const c = r?.counts, o = r?.optical
  return <div className="space-y-4"><div className="flex flex-wrap items-end gap-3"><div><label className="lbl">From</label><input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} /></div><div><label className="lbl">To</label><input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} /></div>
    {r && <button className="btn ml-auto" onClick={csv}><Download size={16} />CSV</button>}</div>
    {err && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{err}</p>}{!r && !err && <p className="p-10 text-center text-sm text-slate-400">Loading…</p>}
    {r && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="Total collection" v={inr(r.collected)} c="text-emerald-600" h="Money actually received in this period" /><S l="Pending to collect" v={inr(r.due)} c="text-red-600" h="Balance still due on bills of this period" /><S l="Discount given" v={inr(r.discount)} /><S l="Cancelled bills" v={c.cancelled_bills ?? r.cancelled_bills} h="Their money is not counted anywhere" /></div>

      <div className="card overflow-x-auto p-5"><H t="Collection by department" s="Only money actually received. Cancelled bills are excluded." />
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-1">Department</th><th className="text-right">Cash</th><th className="text-right">UPI</th><th className="text-right">Card</th><th className="text-right">Total</th></tr></thead>
          <tbody>{D.map(([k, l]) => { const v = r.by_dept[k]; return <tr key={k} className="border-b border-slate-100"><td className="py-1.5 font-semibold">{l}</td><td className="text-right">{inr(v.cash)}</td><td className="text-right">{inr(v.upi)}</td><td className="text-right">{inr(v.card)}</td><td className="text-right font-bold text-emerald-600">{inr(v.total)}</td></tr> })}
            <tr className="bg-slate-50 font-extrabold"><td className="py-2">All departments</td><td className="text-right">{inr(D.reduce((t, [k]) => t + n(r.by_dept[k].cash), 0))}</td><td className="text-right">{inr(D.reduce((t, [k]) => t + n(r.by_dept[k].upi), 0))}</td><td className="text-right">{inr(D.reduce((t, [k]) => t + n(r.by_dept[k].card), 0))}</td><td className="text-right">{inr(r.collected)}</td></tr></tbody></table></div>

      <div className="card overflow-x-auto p-5"><H t="Date-wise collection" s="Each date shows the money received that day, department by department." />
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-slate-500"><th className="py-1">Date</th>{D.map(([k, l]) => <th key={k} className="text-right">{l}</th>)}<th className="text-right">Total</th></tr></thead>
          <tbody>{r.days.map(x => <tr key={x.d} className="border-b border-slate-100"><td className="py-1.5 font-semibold">{x.d}</td>{D.map(([k]) => <td key={k} className="text-right">{inr(x.dept[k])}</td>)}<td className="text-right font-bold text-emerald-600">{inr(x.col)}</td></tr>)}
            <tr className="bg-slate-50 font-extrabold"><td className="py-2">Total</td>{D.map(([k]) => <td key={k} className="text-right">{inr(r.by_dept[k].total)}</td>)}<td className="text-right">{inr(r.collected)}</td></tr></tbody></table></div>

      <div className="card p-5"><H t={`Optical — balance still to collect (as on ${to})`} s="Customers who paid only part of the bill. 'Paid so far' is the part payment already received; 'Balance due' is what is still pending. Cancelled orders are not included." />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="Optical collection in this period" v={inr(r.by_dept.opt.total)} c="text-emerald-600" /><S l="Part-paid orders" v={o.pending_orders} /><S l="Paid so far on those orders" v={inr(o.advance_held)} /><S l="Balance due on those orders" v={inr(o.pending_amount)} c="text-red-600" /></div>
        {o.list.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="p-2">Date</th><th>Bill No</th><th>Patient</th><th>UHID</th><th className="text-right">Bill total</th><th className="text-right">Paid so far</th><th className="p-2 text-right">Balance due</th></tr></thead>
          <tbody>{o.list.map(x => <tr key={x.bill_no} className="border-b border-slate-100"><td className="p-2">{x.date}</td><td>{x.bill_no}</td><td>{x.patient}</td><td>{x.uhid}</td><td className="text-right">{inr(x.total)}</td><td className="text-right">{inr(x.received)}</td><td className="p-2 text-right font-bold text-red-600">{inr(x.pending)}</td></tr>)}</tbody></table></div>}</div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="New patients registered" v={c.new_patients} /><S l="OPD visits (total)" v={c.opd_visits} /><S l="OPD — new patient visits" v={c.opd_new} /><S l="OPD — revisits" v={c.opd_revisit} /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="New admissions" v={c.adm_new} h={`${c.adm_cash} cash · ${c.adm_echs} ECHS · ${c.adm_insurance} insurance`} /><S l="Discharges" v={c.adm_discharged} /><S l="Free follow-up visits" v={c.free_followup} /><S l="ECHS / Insurance (OPD)" v={c.opd_echs + c.opd_insurance} h={`${c.opd_echs} ECHS · ${c.opd_insurance} insurance`} /></div>
      <div className="card p-5"><H t="ECHS / Insurance count" />{[['OPD — ECHS', c.opd_echs], ['OPD — Insurance', c.opd_insurance], ['OPD — other waiver', c.opd_other_waiver], ['Investigation / procedure — ECHS', c.inv_echs], ['Investigation / procedure — Insurance', c.inv_insurance], ['IPD admissions — ECHS', c.adm_echs], ['IPD admissions — Insurance', c.adm_insurance]].map(([k, v]) => <Row key={k} l={k} v={v} />)}</div>

      <div className="card p-5"><H t="Account check" s="Proves that every rupee is accounted for." />
        <Row l="Receipts on valid bills" v={inr(r.receipts_in)} />
        <Row l="Less: refunds paid on valid bills" v={inr(-n(r.refunds_out))} />
        <Row l="Total collection" v={inr(r.collected)} b />
        <Row l="Money of cancelled bills, net (receipt less its refund) — NOT counted" v={inr(r.cancelled_money)} />
        <Row l="Total money movement in the drawer" v={inr(r.drawer_total)} />
        <p className="mt-2 text-[11px] text-slate-500">Total collection + money of cancelled bills = Total money movement. When a bill is cancelled its receipt is refunded, so the net of cancelled bills is normally zero.</p></div>

      <div className="card p-5"><H t="Billing summary (bills made in this period)" s="Gross bill = Discount + Received + Pending." />
        <Row l="Gross bill amount" v={inr(r.gross)} /><Row l="Discount given" v={inr(r.discount)} /><Row l="Received so far" v={inr(r.received_on_bills)} /><Row l="Pending" v={inr(r.due)} b /></div></>}</div>
}