import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase, inr, today } from '../lib/supabase'
const n = x => Number(x || 0)
export default function Reports() {
  const m = today().slice(0, 8) + '01', [from, setFrom] = useState(m), [to, setTo] = useState(today()), [r, setR] = useState(null), [err, setErr] = useState('')
  const load = async () => {
    setErr(''); setR(null); if (to < from) { setErr('The "To" date cannot be before the "From" date.'); return }
    const { data, error } = await supabase.rpc('report_summary', { p_from: from, p_to: to }); if (error) setErr(error.message); else setR(data)
  }
  useEffect(() => { load() }, [from, to])
  const csv = () => {
    const rows = [['Date', 'Bills', 'Billed', 'Net collected', 'Cancelled-bill money (excluded)'], ...r.days.map(x => [x.d, x.n, x.billed, x.col, x.cancelled_money]), [], ['Total', '', r.billed, r.collected, r.cancelled_money]]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(x => x.join(',')).join('\n')], { type: 'text/csv' })); a.download = `report_${from}_to_${to}.csv`; a.click()
  }
  const S = ({ l, v, c, h }) => <div className="card p-5"><div className={`text-2xl font-extrabold ${c || 'text-navy'}`}>{v}</div><div className="text-xs font-medium text-slate-500">{l}</div>{h && <div className="mt-1 text-[11px] text-slate-400">{h}</div>}</div>
  const Brk = ({ t, o, money = true }) => <div className="card p-5"><h3 className="mb-2 font-extrabold text-navy">{t}</h3>{Object.keys(o).length === 0 ? <p className="text-xs text-slate-400">No data.</p> : Object.entries(o).map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-100 py-1.5 text-sm last:border-0"><span>{k}</span><b>{money ? inr(v) : v}</b></div>)}</div>
  const Row = ({ l, v, b }) => <div className={`flex justify-between py-1.5 text-sm ${b ? 'border-t-2 border-navy font-extrabold text-navy' : 'border-b border-slate-100'}`}><span>{l}</span><span>{v}</span></div>
  const c = r?.counts, o = r?.optical
  return <div className="space-y-4"><div className="flex flex-wrap items-end gap-3"><div><label className="lbl">From</label><input type="date" className="inp" value={from} onChange={e => setFrom(e.target.value)} /></div><div><label className="lbl">To</label><input type="date" className="inp" value={to} onChange={e => setTo(e.target.value)} /></div>
    {r && <button className="btn ml-auto" onClick={csv}><Download size={16} />CSV</button>}</div>
    {err && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{err}</p>}{!r && !err && <p className="p-10 text-center text-sm text-slate-400">Loading…</p>}
    {r && <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="Net collection" v={inr(r.collected)} c="text-emerald-600" h="Payments received minus refunds, on valid bills only" /><S l="Billed (net)" v={inr(r.billed)} h="Cancelled bills excluded" /><S l="Outstanding dues" v={inr(r.due)} c="text-red-600" h="On bills of this period, as at the end date" /><S l="Discount given" v={inr(r.discount)} /></div>

      <div className="card p-5"><h3 className="mb-2 font-extrabold text-navy">Account reconciliation</h3>
        <Row l="Total money movement in the period (all receipts less all refunds)" v={inr(r.drawer_total)} />
        <Row l="Less: receipts on bills that were later cancelled" v={inr(-n(r.cancelled_receipts))} />
        <Row l="Add back: refunds paid out for those cancelled bills" v={inr(r.cancelled_refunds)} />
        <Row l="Net collection (valid bills only)" v={inr(r.collected)} b />
        <p className="mt-2 text-[11px] text-slate-500">Receipts {inr(r.receipts_in)} − refunds {inr(r.refunds_out)} = {inr(r.collected)}. Money linked to a cancelled bill is never counted in the figures above; it is shown here only so the cash drawer can be tied.</p></div>

      <div className="card p-5"><h3 className="mb-1 font-extrabold text-navy">Optical — advance &amp; pending as at {to}</h3>
        <p className="mb-3 text-[11px] text-slate-500">Cancelled optical bills are excluded. Balances are calculated from payments received up to the end of the selected date.</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="Advance held (part-paid orders)" v={inr(o.advance_held)} c="text-amber-600" h={`${o.advance_orders} orders`} /><S l="Balance pending" v={inr(o.pending_amount)} c="text-red-600" h={`${o.pending_orders} orders`} /><S l="Optical sales in period" v={o.sales_in_range} /><S l="Optical billed in period" v={inr(o.billed_in_range)} /></div>
        {o.list.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="p-2">Date</th><th>Bill No</th><th>Patient</th><th>UHID</th><th className="text-right">Total</th><th className="text-right">Advance received</th><th className="p-2 text-right">Pending</th></tr></thead>
          <tbody>{o.list.map(x => <tr key={x.bill_no} className="border-b border-slate-100"><td className="p-2">{x.date}</td><td>{x.bill_no}</td><td>{x.patient}</td><td>{x.uhid}</td><td className="text-right">{inr(x.total)}</td><td className="text-right">{inr(x.received)}</td><td className="p-2 text-right font-bold text-red-600">{inr(x.pending)}</td></tr>)}</tbody></table></div>}</div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="New patients registered" v={c.new_patients} /><S l="OPD visits (total)" v={c.opd_visits} /><S l="OPD — new patient visits" v={c.opd_new} /><S l="OPD — revisits" v={c.opd_revisit} /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="New admissions" v={c.adm_new} h={`${c.adm_cash} cash · ${c.adm_echs} ECHS · ${c.adm_insurance} insurance`} /><S l="Discharges" v={c.adm_discharged} /><S l="Free follow-up visits" v={c.free_followup} /><S l="Cancelled bills" v={r.cancelled_bills} /></div>
      <Brk t="ECHS / Insurance count" money={false} o={{ 'OPD — ECHS': c.opd_echs, 'OPD — Insurance': c.opd_insurance, 'OPD — other waiver': c.opd_other_waiver, 'Investigation / procedure — ECHS': c.inv_echs, 'Investigation / procedure — Insurance': c.inv_insurance, 'IPD admissions — ECHS': c.adm_echs, 'IPD admissions — Insurance': c.adm_insurance }} />
      <div className="grid gap-4 md:grid-cols-2"><Brk t="Net collection by mode" o={r.by_mode} /><Brk t="Billing by type" o={r.by_kind} /></div>
      <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="p-3">Date</th><th>Bills</th><th className="text-right">Billed</th><th className="text-right">Net collected</th><th className="p-3 text-right">Cancelled-bill money (excluded)</th></tr></thead>
        <tbody>{r.days.map(x => <tr key={x.d} className="border-b border-slate-100"><td className="p-3 font-semibold">{x.d}</td><td>{x.n}</td><td className="text-right">{inr(x.billed)}</td><td className="text-right">{inr(x.col)}</td><td className="p-3 text-right text-slate-400">{inr(x.cancelled_money)}</td></tr>)}
          <tr className="bg-slate-50 font-extrabold"><td className="p-3">Total</td><td></td><td className="text-right">{inr(r.billed)}</td><td className="text-right">{inr(r.collected)}</td><td className="p-3 text-right">{inr(r.cancelled_money)}</td></tr></tbody></table></div></>}</div>
}