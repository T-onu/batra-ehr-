import { useEffect, useState } from 'react'
import { Search, Trash2, Plus } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
import Receipt from '../components/Receipt'
import PatientPick from '../components/PatientPick'
import ProcedurePick from '../components/ProcedurePick'
const AUTH = ['Dr. Akhil Batra', 'Dr. Sunanda', 'Other']
export default function Investigations({ profile }) {
  const role = profile?.role, canBill = ['Doctor', 'Admin', 'Super Admin'].includes(role), canPay = ['Admin', 'Super Admin'].includes(role), isAdm = ['Admin', 'Super Admin'].includes(role)
  const [tab, setTab] = useState('new'), [cat, setCat] = useState([]), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [rcpt, setRcpt] = useState(null)
  const loadCat = async () => { const { data } = await supabase.from('catalog_items').select('*').eq('active', true).order('name'); setCat(data || []) }
  useEffect(() => { loadCat() }, [])
  // new order
  const [pt, setPt] = useState(null), ctx = 'OPD', [lines, setLines] = useState([]), [q, setQ] = useState(''), [cust, setCust] = useState(''), [disc, setDisc] = useState(''), [au, setAu] = useState(AUTH[0]), [auO, setAuO] = useState(''), [paid, setPaid] = useState(''), [mode, setMode] = useState('Cash'), [ref, setRef] = useState(''), [rem, setRem] = useState('')
  const kind = 'opd_investigation'
  const sub = lines.reduce((a, l) => a + (+l.charge || 0), 0), tot = Math.max(0, sub - (+disc || 0)), setL = (i, v) => setLines(lines.map((l, j) => j === i ? { ...l, charge: v } : l))
  const add = (name, category, rate) => { if (!lines.find(l => l.name === name)) setLines([...lines, { name, category, charge: rate == null ? '' : String(rate) }]); setQ(''); setCust('') }
  const submit = async () => {
    setErr(''); if (!pt) return setErr('Select a patient'); if (!lines.length) return setErr('Add at least one investigation or procedure'); if (canPay && +paid > 0 && mode !== 'Cash' && !ref.trim()) return setErr(mode === 'UPI' ? 'Enter the UPI transaction / UTR number' : 'Enter the card slip number or last 4 digits'); setBusy(true)
    const { data: id, error } = await supabase.rpc('order_investigations', { p_patient: pt.id, p_ctx: ctx, p_adm: null, p_items: lines.map(l => ({ name: l.name, category: l.category, charge: l.charge === '' ? null : +l.charge })), p_discount: canPay ? +disc || 0 : 0, p_authority: au === 'Other' ? auO : au, p_paid: canPay ? +paid || 0 : 0, p_mode: mode, p_ref: ref, p_remarks: rem })
    setBusy(false); if (error) return setErr(error.message)
    const { data: b } = await supabase.from('bills').select('*, patients(name,uhid)').eq('id', id).single(); setRcpt(b); setPt(null); setLines([]); setDisc(''); setPaid(''); setRef(''); setRem('')
  }
  // master
  const [mk, setMk] = useState('opd_investigation'), [mn, setMn] = useState(''), [mq, setMq] = useState('')
  const setRate = async c => { const v = prompt(`Charge for "${c.name}" in ₹ (leave empty to clear):`, c.rate ?? ''); if (v === null) return; const val = v.trim() === '' ? null : Number(v); if (val !== null && (isNaN(val) || val < 0)) return alert('Enter a valid amount'); const { error } = await supabase.from('catalog_items').update({ rate: val }).eq('id', c.id); if (error) alert(error.message); else loadCat() }
  const importCsv = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return; const lines = (await file.text()).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const byName = Object.fromEntries(cat.filter(c => c.kind === mk).map(c => [c.name.toLowerCase(), c.name])), rows = []; let skipped = 0
    for (const l of lines) {
      const i = l.lastIndexOf(','); if (i < 0) { skipped++; continue }; const name = l.slice(0, i).replace(/^"|"$/g, '').trim(), rs = l.slice(i + 1).replace(/[^0-9.]/g, ''); if (!name || rs === '') { skipped++; continue }
      rows.push({ kind: mk, name: byName[name.toLowerCase()] || name, rate: Number(rs), category: mk === 'opd_investigation' ? 'Ophthalmology Investigation' : 'Ophthalmology Procedure' })
    }
    if (!rows.length) return alert('No valid rows found. Use two columns: name, charge.')
    const { error } = await supabase.from('catalog_items').upsert(rows, { onConflict: 'kind,name' }); if (error) return alert(error.message); alert(`${rows.length} charges saved${skipped ? `, ${skipped} row(s) skipped` : ''}.`); loadCat()
  }
  const addCat = async () => { if (!mn.trim()) return; const { error } = await supabase.from('catalog_items').insert({ kind: mk, name: mn.trim(), category: mk === 'opd_investigation' ? 'Ophthalmology Investigation' : 'Ophthalmology Procedure' }); if (error) alert(error.message); else { setMn(''); loadCat() } }
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{[['new', 'New order'], ['master', 'Master list']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-navy text-white' : 'bg-white text-slate-500'}`}>{l}</button>)}</div>
    {tab === 'new' && <div className="grid gap-4 lg:grid-cols-[1fr_320px]">{!canBill && <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700 lg:col-span-2">Your role cannot create investigation orders (Doctors and Admins can).</p>}
      <div className="space-y-4"><div className="card space-y-3 p-5"><PatientPick pt={pt} setPt={setPt} />
      </div>
        <div className="card space-y-3 p-5"><ProcedurePick items={cat.filter(c => c.kind === kind)} value={q} onChange={setQ} onPick={c => add(c.name, c.category, c.rate)} placeholder="Click to choose an investigation / procedure, or type to search" />
          <div className="flex gap-2"><input className="inp" placeholder="Custom item (if not in the list)" value={cust} onChange={e => setCust(e.target.value)} /><button className="btn !px-3" onClick={() => cust.trim() && add(cust.trim(), 'Custom')}><Plus size={16} /></button></div>
          {lines.map((l, i) => <div key={l.name} className="grid grid-cols-[1fr_96px_24px] items-center gap-2 text-sm"><span>{l.name}</span><input className="inp !px-2" type="number" placeholder="Charge ₹" value={l.charge} onChange={e => setL(i, e.target.value)} /><button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button></div>)}
          {lines.length === 0 && <p className="text-xs text-slate-400">Choose from the list. The charge fills in automatically when it is listed; otherwise enter it manually. You can edit any charge.</p>}</div></div>
      <div className="card h-fit space-y-3 p-5"><div className="flex justify-between text-sm"><span>Subtotal</span><b>{inr(sub)}</b></div>{canPay && <div><label className="lbl">Discount (₹)</label><input className="inp" type="number" value={disc} onChange={e => setDisc(e.target.value)} /></div>}
        {canPay && +disc > 0 && <div><label className="lbl">Discount authority *</label><select className="inp" value={au} onChange={e => setAu(e.target.value)}>{AUTH.map(a => <option key={a}>{a}</option>)}</select>{au === 'Other' && <input className="inp mt-2" placeholder="Full name" value={auO} onChange={e => setAuO(e.target.value)} />}</div>}
        <div><label className="lbl">Remarks (optional)</label><textarea rows={2} className="inp" placeholder="e.g. right eye, urgent, referred by…" value={rem} onChange={e => setRem(e.target.value)} /></div>
        <div className="flex justify-between border-t pt-3 text-lg font-extrabold text-navy"><span>Total</span><span>{inr(tot)}</span></div>
        {!canPay && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Payment is collected by the billing desk (Money Receipt).</p>}
        {canPay && <><div className="grid grid-cols-2 gap-2"><div><label className="lbl">Paid (₹)</label><input className="inp" type="number" value={paid} onChange={e => setPaid(e.target.value)} /></div><div><label className="lbl">Mode</label><select className="inp" value={mode} onChange={e => setMode(e.target.value)}><option>Cash</option><option>UPI</option><option>Card</option></select></div></div>
          {mode !== 'Cash' && +paid > 0 && <div><label className="lbl">{mode === 'UPI' ? 'UPI Txn / UTR number *' : 'Card slip no. or last 4 digits *'}</label><input className="inp" value={ref} onChange={e => setRef(e.target.value)} /></div>}</>}
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}<button className="btn w-full" disabled={busy || !canBill} onClick={submit}>{busy ? 'Saving…' : 'Generate receipt'}</button></div></div>}
    {tab === 'master' && <div className="space-y-3">{isAdm && <div className="card flex flex-wrap items-end gap-3 p-5"><div><label className="lbl">Type</label><select className="inp" value={mk} onChange={e => setMk(e.target.value)}><option value="opd_investigation">OPD investigation</option><option value="ipd_procedure">IPD procedure</option></select></div>
      <div className="min-w-[220px] flex-1"><label className="lbl">New item</label><input className="inp" value={mn} onChange={e => setMn(e.target.value)} /></div><button className="btn" onClick={addCat}><Plus size={16} />Add</button><label className="btn cursor-pointer !bg-white !text-navy ring-1 ring-slate-200">Import charges (CSV)<input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} /></label></div>}
      <input className="inp" placeholder="Search master list" value={mq} onChange={e => setMq(e.target.value)} />
      {[['opd_investigation', 'OPD investigations'], ['ipd_procedure', 'IPD procedures']].map(([k, l]) => { const r = cat.filter(c => c.kind === k && (!mq.trim() || c.name.toLowerCase().includes(mq.toLowerCase()))); return <div key={k} className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-3 font-bold text-navy">{l} <span className="text-xs font-medium text-slate-400">({r.length})</span></div><div className="max-h-80 divide-y divide-slate-100 overflow-auto">{r.map(c => <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-2 text-sm"><span>{c.name}</span><span className="flex shrink-0 items-center gap-3"><b className={c.rate == null ? 'text-slate-300' : 'text-navy'}>{c.rate == null ? 'No charge set' : inr(c.rate)}</b>{isAdm && <button className="text-xs font-semibold text-accent" onClick={() => setRate(c)}>Edit</button>}</span></div>)}</div></div> })}</div>}
    {rcpt && <Receipt b={rcpt} onClose={() => setRcpt(null)} />}</div>
}