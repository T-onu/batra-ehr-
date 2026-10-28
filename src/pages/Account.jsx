import { useEffect, useState } from 'react'
import { Search, X, Plus, Trash2 } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
import Receipt from '../components/Receipt'
import PrintSheet from '../components/PrintSheet'
import { words } from '../lib/words'
const AUTH = ['Dr. Akhil Batra', 'Dr. Sunanda', 'Other'], SUG = ['Room rent', 'OT charges', 'Surgeon fee', 'Anaesthesia', 'Nursing charges', 'Medicines', 'Consumables', 'IOL / implant', 'Investigations']
const dt = d => d ? new Date(d).toLocaleDateString('en-GB') : '—'
const Modal = ({ title, onClose, children }) => <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 backdrop-blur-sm sm:place-items-center sm:p-4"><div className="card max-h-[92dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl"><div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-navy">{title}</h2><button onClick={onClose}><X /></button></div>{children}</div></div>
export default function Account({ profile }) {
  const canPay = ['Admin', 'Super Admin'].includes(profile?.role), isAdm = ['Admin', 'Super Admin'].includes(profile?.role)
  const [q, setQ] = useState(''), [hits, setHits] = useState([]), [pt, setPt] = useState(null), [focus, setFocus] = useState(null), [bills, setBills] = useState([]), [pays, setPays] = useState([]), [adms, setAdms] = useState([]), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const [cat, setCat] = useState([]), [hist, setHist] = useState(false), [rcv, setRcv] = useState(null), [svc, setSvc] = useState(null), [show, setShow] = useState(null), [vch, setVch] = useState(null)
  useEffect(() => { supabase.from('catalog_items').select('name,rate').eq('kind', 'ipd_procedure').eq('active', true).then(({ data }) => setCat(data || [])) }, [])
  const nameSvc = (i, v) => { const c = cat.find(x => x.name.toLowerCase() === v.trim().toLowerCase()); setSvc(s => ({ ...s, rows: s.rows.map((x, j) => j === i ? { ...x, d: v, r: x.r === '' && c?.rate != null ? String(c.rate) : x.r } : x) })) }
  const load = async p => {
    p = p || pt; if (!p) return
    const { data: b } = await supabase.from('bills').select('*, visits(visit_no), admissions(adm_no,status,procedure)').eq('patient_id', p.id).order('created_at', { ascending: false }); setBills(b || [])
    const ids = (b || []).map(x => x.id); const { data: pm } = ids.length ? await supabase.from('payments').select('*').in('bill_id', ids).order('created_at') : { data: [] }; setPays(pm || [])
    const { data: ad } = await supabase.from('admissions').select('*').eq('patient_id', p.id).in('status', ['Admitted', 'Discharged']).order('created_at', { ascending: false }); setAdms(ad || [])
  }
  const pick = (p, f) => { setPt(p); setFocus(f); setHits([]); setQ(''); setMsg(''); setErr(''); load(p) }
  const search = async () => {
    setErr(''); setHits([]); const t = q.trim().replace(/[,()%]/g, ' ').trim(); if (!t) return
    const u = /^\d{1,6}$/.test(t) ? t.padStart(6, '0') : t
    const [p, v, a] = await Promise.all([supabase.from('patients').select('*').or(`uhid.ilike.${u},legacy_uhid.ilike.${t},name.ilike.%${t}%,phone.ilike.%${t}%`).limit(8),
    supabase.from('visits').select('visit_no,patients(*)').or(`visit_no.ilike.${t},legacy_no.ilike.${t}`).limit(1), supabase.from('admissions').select('adm_no,patients(*)').or(`adm_no.ilike.${t},legacy_no.ilike.${t}`).limit(1)])
    if (v.data?.length) return pick(v.data[0].patients, { type: 'OPD', no: v.data[0].visit_no }); if (a.data?.length) return pick(a.data[0].patients, { type: 'IPD', no: a.data[0].adm_no })
    const l = p.data || []; if (l.length === 1) pick(l[0], null); else if (!l.length) setErr('No patient, OPD number or IPD number matches.'); else setHits(l)
  }
  const act = bills.filter(b => b.status !== 'Cancelled'), billed = act.reduce((s, b) => s + Number(b.total), 0), got = act.reduce((s, b) => s + Number(b.paid), 0), bal = billed - got
  const hasBill = id => bills.find(b => b.admission_id === id && b.kind === 'IPD' && b.status === 'Active')
  const nb = x => (x || '').replace(/^BEH-?/, ''), ipdT = adms.filter(a => a.status === 'Admitted').map(a => {
    const b = hasBill(a.id), due = b ? b.total - b.paid : 0, r = cat.find(c => c.name.toLowerCase() === (a.procedure || '').trim().toLowerCase())?.rate
    return { v: b ? b.id : 'adm:' + a.id, l: `IPD Advance · ${nb(a.adm_no)} · ${a.procedure}`, amt: due > 0 ? String(due) : (r != null ? String(r) : ''), no: a.adm_no, aid: a.id, proc: (a.procedure || '').trim(), rate: r }
  }),
    dueT = act.filter(b => b.kind !== 'IPD' && b.total - b.paid > 0).map(b => ({ v: b.id, l: `${b.kind} due · ${nb(b.visits?.visit_no || b.bill_no)}`, amt: String(b.total - b.paid) })),
    targets = ipdT.length ? ipdT : dueT
  const dueOk = v => !!v && targets.some(t => t.v === v && (!String(v).startsWith('adm:') || (t.rate != null && t.rate > 0)))
  const startRcv = () => {
    if (!targets.length) return setMsg('No admitted IPD patient or pending bill for this patient.')
    const t = (focus?.type === 'IPD' && targets.find(x => x.no === focus.no)) || targets[0]; setRcv({ target: t.v, amount: t.amt, mode: 'Cash', remarks: '', ref: '', disc: '', au: AUTH[0], auO: '' }); setErr('')
  }
  const submitRcv = async () => {
    setErr(''); const amt = +rcv.amount || 0, dsc = dueOk(rcv.target) ? (+rcv.disc || 0) : 0; if (!(amt > 0) && !(dsc > 0)) return setErr('Enter an amount greater than 0'); if (dsc > 0 && rcv.au === 'Other' && !rcv.auO.trim()) return setErr('Enter the full name of the discount authority'); if (amt > 0 && rcv.mode !== 'Cash' && !rcv.ref.trim()) return setErr(rcv.mode === 'UPI' ? 'Enter the UPI transaction / UTR number' : 'Enter the card slip number or last 4 digits'); setBusy(true)
    try {
      let bill = rcv.target || null; if (bill && bill.startsWith('adm:')) { const tg = targets.find(x => x.v === rcv.target), items = dsc > 0 && tg?.rate > 0 ? [{ d: tg.proc, q: 1, r: tg.rate, c: 'Procedure' }] : []; const { data, error } = await supabase.rpc('ipd_add_service', { p_adm: bill.slice(4), p_items: items }); if (error) throw error; bill = data }
      const { data, error } = await supabase.rpc('receive_payment', { p_patient: pt.id, p_bill: bill, p_amount: amt, p_mode: rcv.mode, p_remarks: rcv.remarks, p_ref: rcv.ref, p_discount: dsc, p_authority: rcv.au === 'Other' ? rcv.auO : rcv.au }); if (error) throw error
      setRcv(null); setMsg(data.receipt_no ? `Receipt ${data.receipt_no} · ${inr(data.amount)} received${dsc > 0 ? ` · discount ${inr(dsc)}` : ''}` : `Discount ${inr(dsc)} applied`); await load(); if (data.receipt_no) setVch(data.receipt_no)
    } catch (e) { setErr(e.message) } setBusy(false)
  }
  const submitSvc = async () => {
    setErr(''); const rows = svc.rows.filter(r => r.d.trim() || r.r).map(r => ({ d: r.d.trim(), q: +r.q || 0, r: r.r === '' ? -1 : +r.r, c: r.c || 'Other' })); if (!svc.adm) return setErr('Select an admission'); if (!rows.length) return setErr('Add at least one service'); setBusy(true)
    const { error } = await supabase.rpc('ipd_add_service', { p_adm: svc.adm, p_items: rows, p_discount: +svc.disc || 0, p_authority: svc.au === 'Other' ? svc.auO : svc.au }); setBusy(false); if (error) return setErr(error.message)
    setSvc(null); setMsg('Services added to the IPD bill'); load()
  }
  const cancel = async rno => { const reason = prompt(`Cancel receipt ${rno}? Enter a reason (required):`); if (!reason?.trim()) return; const { error } = await supabase.rpc('cancel_receipt', { p_receipt: rno, p_reason: reason }); if (error) alert(error.message); else { setMsg(`Receipt ${rno} cancelled`); load() } }
  const pendBills = act.filter(b => b.total - b.paid > 0), pend = pendBills.reduce((s, b) => s + Number(b.total) - Number(b.paid), 0)
  const groups = Object.values(pays.reduce((m, p) => { (m[p.receipt_no] = m[p.receipt_no] || { no: p.receipt_no, rows: [] }).rows.push(p); return m }, {})).sort((a, b) => b.rows[0].created_at.localeCompare(a.rows[0].created_at))
  const vr = vch ? pays.filter(p => p.receipt_no === vch) : [], vt = vr.reduce((s, p) => s + Number(p.amount), 0), bm = Object.fromEntries(bills.map(b => [b.id, b]))
  const Tile = ({ l, v, c }) => <div className="card p-4"><div className={`text-xl font-extrabold ${c || 'text-navy'}`}>{v}</div><div className="text-xs text-slate-500">{l}</div></div>
  return <div className="space-y-4">
    <div className="card space-y-2 p-4"><form onSubmit={e => { e.preventDefault(); search() }} className="flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3 text-slate-400" /><input className="inp pl-10" placeholder="UHID, OPD no, IPD no, phone or name" value={q} onChange={e => setQ(e.target.value)} /></div><button className="btn">Find</button></form>
      {err && !rcv && !svc && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}{hits.map(p => <button key={p.id} onClick={() => pick(p, null)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-400">{p.uhid} · {p.phone}</span></button>)}</div>
    {msg && <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{msg}</p>}
    {!pt && <p className="p-8 text-center text-sm text-slate-400">Enter a UHID (000001), OPD number (OPD000001) or IPD number (IP191026063) to see the patient's bills, receipts and balance.</p>}
    {pt && <><div className="card flex flex-wrap items-center gap-3 p-4 sm:p-5"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy text-lg font-extrabold text-white">{pt.name[0]}</div>
      <div className="min-w-0 flex-1"><div className="text-lg font-extrabold text-navy">{pt.name} <span className="rounded-lg bg-navy-50 px-2 py-0.5 align-middle text-xs">{pt.uhid}</span></div><div className="text-xs text-slate-500">{pt.age ? pt.age + 'y · ' : ''}{pt.sex} · {pt.phone || 'no phone'}{pt.address && ' · ' + pt.address}</div>{focus && <div className="mt-1 text-xs font-semibold text-accent">Opened by {focus.type} No {focus.no}</div>}</div>
      {canPay && <div className="flex flex-wrap gap-2"><button className="btn" onClick={startRcv}>Receive payment</button><button className="btn !bg-white !text-navy ring-1 ring-slate-200" onClick={() => setHist(true)}>Payment history</button>{adms.length > 0 && <button className="btn !bg-white !text-navy ring-1 ring-slate-200" onClick={() => { setSvc({ adm: (focus?.type === 'IPD' && adms.find(a => a.adm_no === focus.no)?.id) || adms[0].id, rows: [{ d: '', q: 1, r: '', c: 'Procedure' }], disc: '', au: AUTH[0], auO: '' }); setErr('') }}>Add IPD service</button>}</div>}</div>
    </>}
    {hist && <Modal title="Payment history" onClose={() => setHist(false)}><div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><b className="text-sm text-navy">Payments received</b><b className="text-emerald-600">{inr(got)}</b></div>
      {groups.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No payments yet.</p>}
      <div className="divide-y divide-slate-100">{groups.map(g => {
        const tot = g.rows.reduce((s, p) => s + Number(p.amount), 0), dead = g.rows.every(p => p.cancelled_at) && tot > 0, r0 = g.rows[0]
        return <div key={g.no} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5"><div className="min-w-0 flex-1"><span className={dead ? 'line-through opacity-60' : ''}><b>{g.no}</b> <span className="text-xs text-slate-400">{dt(r0.created_at)}</span></span>{dead && <span className="ml-2 text-[10px] font-bold text-red-500">CANCELLED</span>}
          <div className="text-xs text-slate-500"><span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{r0.mode}</span> {g.rows.map(p => bm[p.bill_id]?.bill_no).filter(Boolean).join(', ')}{r0.txn_ref && ' · Ref ' + r0.txn_ref}{r0.remarks && ' · ' + r0.remarks}</div></div>
          <b className={tot < 0 ? 'text-red-600' : 'text-emerald-700'}>{inr(tot)}</b><button className="text-xs font-semibold text-accent" onClick={() => setVch(g.no)}>Voucher</button>{isAdm && g.rows.some(p => p.amount > 0 && !p.cancelled_at) && <button className="text-xs text-red-500" onClick={() => cancel(g.no)}>Cancel</button>}</div>
      })}</div></div></Modal>}
    {rcv && <Modal title="Receive payment" onClose={() => setRcv(null)}><div><label className="lbl">{ipdT.length ? 'IPD admission' : 'Against'}</label><select className="inp" value={rcv.target} onChange={e => { const t = targets.find(x => x.v === e.target.value); setRcv({ ...rcv, target: e.target.value, amount: t?.amt ?? '' }) }}>{targets.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>{ipdT.length > 0 && <p className="mt-1 text-[11px] text-slate-400">The amount is filled from the procedure charge when it is listed. Otherwise enter it manually.</p>}</div>
      <div className="grid grid-cols-2 gap-3"><div><label className="lbl">Amount (₹)</label><input className="inp" type="number" value={rcv.amount} onChange={e => setRcv({ ...rcv, amount: e.target.value })} /></div><div><label className="lbl">Mode</label><select className="inp" value={rcv.mode} onChange={e => setRcv({ ...rcv, mode: e.target.value })}><option>Cash</option><option>UPI</option><option>Card</option></select></div></div>
      {rcv.mode !== 'Cash' && <div><label className="lbl">{rcv.mode === 'UPI' ? 'UPI Txn / UTR number *' : 'Card slip no. or last 4 digits *'}</label><input className="inp" value={rcv.ref} onChange={e => setRcv({ ...rcv, ref: e.target.value })} />{rcv.mode === 'Card' && <p className="mt-1 text-[11px] text-slate-400">Never enter the full card number.</p>}</div>}
      {dueOk(rcv.target) && <div className="grid grid-cols-2 gap-3"><div><label className="lbl">Discount (₹)</label><input className="inp" type="number" min="0" value={rcv.disc} onChange={e => { const t = targets.find(x => x.v === rcv.target), d = Math.max(0, +e.target.value || 0); setRcv({ ...rcv, disc: e.target.value, amount: String(Math.max(0, (+t?.amt || 0) - d)) }) }} /></div>
        {+rcv.disc > 0 && <div><label className="lbl">Discount authority *</label><select className="inp" value={rcv.au} onChange={e => setRcv({ ...rcv, au: e.target.value })}>{AUTH.map(a => <option key={a}>{a}</option>)}</select></div>}{+rcv.disc > 0 && rcv.au === 'Other' && <input className="inp col-span-2" placeholder="Full name" value={rcv.auO} onChange={e => setRcv({ ...rcv, auO: e.target.value })} />}</div>}
      <div><label className="lbl">Remarks (optional)</label><input className="inp" value={rcv.remarks} onChange={e => setRcv({ ...rcv, remarks: e.target.value })} /></div>{err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}<button className="btn w-full" disabled={busy} onClick={submitRcv}>{busy ? 'Saving…' : 'Receive & print voucher'}</button></Modal>}
    {svc && <Modal title="Add IPD services" onClose={() => setSvc(null)}><div><label className="lbl">Admission</label><select className="inp" value={svc.adm} onChange={e => setSvc({ ...svc, adm: e.target.value })}>{adms.map(a => <option key={a.id} value={a.id}>{nb(a.adm_no)} · {a.procedure} ({a.status})</option>)}</select></div>
      <datalist id="sug">{[...SUG, ...cat.map(c => c.name)].map((s, i) => <option key={s + i}>{s}</option>)}</datalist>{svc.rows.map((r, i) => <div key={i} className="grid grid-cols-[1fr_56px_84px_24px] items-center gap-2 sm:grid-cols-[1fr_110px_56px_84px_24px]"><input list="sug" className="inp" placeholder="Service" value={r.d} onChange={e => nameSvc(i, e.target.value)} /><select className="inp col-span-4 !px-2 sm:col-span-1 sm:order-none order-last" value={r.c || 'Procedure'} onChange={e => setSvc({ ...svc, rows: svc.rows.map((x, j) => j === i ? { ...x, c: e.target.value } : x) })}><option>Procedure</option><option>Investigation</option><option>Other</option></select>
        <input className="inp !px-2 text-center" type="number" value={r.q} onChange={e => setSvc({ ...svc, rows: svc.rows.map((x, j) => j === i ? { ...x, q: e.target.value } : x) })} /><input className="inp !px-2" type="number" placeholder="Rate" value={r.r} onChange={e => setSvc({ ...svc, rows: svc.rows.map((x, j) => j === i ? { ...x, r: e.target.value } : x) })} />
        <button onClick={() => setSvc({ ...svc, rows: svc.rows.length > 1 ? svc.rows.filter((_, j) => j !== i) : svc.rows })} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></div>)}
      <button className="text-xs font-semibold text-accent" onClick={() => setSvc({ ...svc, rows: [...svc.rows, { d: '', q: 1, r: '', c: 'Procedure' }] })}><Plus size={12} className="inline" /> Add row</button>
      <div><label className="lbl">Discount on these services (₹)</label><input className="inp" type="number" value={svc.disc} onChange={e => setSvc({ ...svc, disc: e.target.value })} /></div>
      {+svc.disc > 0 && <div><label className="lbl">Discount authority *</label><select className="inp" value={svc.au} onChange={e => setSvc({ ...svc, au: e.target.value })}>{AUTH.map(a => <option key={a}>{a}</option>)}</select>{svc.au === 'Other' && <input className="inp mt-2" placeholder="Full name" value={svc.auO} onChange={e => setSvc({ ...svc, auO: e.target.value })} />}</div>}
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}<button className="btn w-full" disabled={busy} onClick={submitSvc}>{busy ? 'Saving…' : 'Add to IPD bill'}</button></Modal>}
    {show && <Receipt b={show} onClose={() => setShow(null)} />}
    {vch && vr.length > 0 && <PrintSheet title={vt < 0 ? 'REFUND VOUCHER' : 'RECEIPT VOUCHER'} meta={[vch, dt(vr[0].created_at)]} onClose={() => setVch(null)}>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs"><div>Patient: <b>{pt.name}</b></div><div>UHID: <b>{pt.uhid}</b></div><div className="col-span-2">{pt.address}</div></div>
      <table className="w-full text-left text-xs"><thead><tr className="border-y bg-slate-50"><th className="p-2">Description</th><th>Reference</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{vr.map(p => { const b = bm[p.bill_id]; return <tr key={p.id} className="border-b border-slate-100"><td className="p-2">{b?.kind === 'IPD' ? `IPD ${p.amount < 0 ? 'refund' : 'payment'} · ${b?.admissions?.procedure || ''}` : (b?.items || []).map(x => x.d).join(', ') || b?.kind}</td><td>{nb(b?.visits?.visit_no || b?.admissions?.adm_no || b?.bill_no) || '—'}</td><td className="p-2 text-right">{inr(p.amount)}</td></tr> })}</tbody></table>
      <div className="ml-auto w-56 space-y-1 text-xs"><div className="flex justify-between text-sm font-bold"><span>Total {vt < 0 ? 'refunded' : 'received'}</span><span>{inr(Math.abs(vt))}</span></div><div className="flex justify-between"><span>Mode</span><span>{vr[0].mode}</span></div>{vr[0].txn_ref && <div className="flex justify-between"><span>Txn / UTR</span><span>{vr[0].txn_ref}</span></div>}</div>
      <p className="text-xs"><b>Amount in words:</b> {words(Math.abs(vt))}</p>{vr[0].remarks && <p className="text-xs"><b>Remarks:</b> {vr[0].remarks}</p>}
      <div className="flex justify-between pt-10 text-xs text-slate-400"><span>Computer generated voucher{vr[0].issued_by && <><br />Created by: {vr[0].issued_by}</>}</span><span className="border-t border-slate-400 px-6 pt-1">Received by</span></div></PrintSheet>}</div>
}