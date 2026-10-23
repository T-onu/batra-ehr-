import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase, inr } from '../lib/supabase'
const AUTH = ['Dr. Akhil Batra', 'Dr. Sunanda', 'Other'], DOCS = ['Dr. Akhil Batra', 'Dr. Sunanda'], REL = ['S/O', 'D/O', 'W/O', 'C/O'], CATS = ['ECHS', 'Insurance', 'Other']
// OPD fee by India time: Rs 100 from 8:30 AM to 4:00 PM, Rs 200 at other times (the database applies the same rule)
export const istFee = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()), t = (+p.find(x => x.type === 'hour').value % 24) * 60 + (+p.find(x => x.type === 'minute').value); return t >= 510 && t <= 960 ? 100 : 200 }
const blank = { name: '', age: '', sex: 'Male', phone: '', address: '', consultant: DOCS[0], father: '', relation: 'S/O', ref: '', cat: '', discount: '', au: AUTH[0], auO: '', paid: '', mode: 'Cash' }
export default function OpdRegister({ patient, onDone, onClose }) {
  const [f, setF] = useState(blank), [fee, setFee] = useState(istFee()), [why, setWhy] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  // The fee is calculated by the database (10-day free follow-up, under-18 rate, day / after-hours rate in India time)
  useEffect(() => {
    let live = true; const go = async () => { const { data } = await supabase.rpc('opd_fee_info', { p_patient: patient?.id || null, p_age: f.age !== '' ? +f.age : null, p_consultant: f.consultant }); if (live && data) { setFee(+data.fee); setWhy(data.reason) } }
    const t = setTimeout(go, 250), iv = setInterval(go, 30000); return () => { live = false; clearTimeout(t); clearInterval(iv) }
  }, [patient?.id, f.age, f.consultant])
  const set = k => e => setF({ ...f, [k]: e.target.value }), waived = !!f.cat, d = waived ? fee : (+f.discount || 0), net = Math.max(0, fee - d), paid = waived ? 0 : (f.paid === '' ? net : +f.paid)
  const submit = async e => {
    e.preventDefault(); setErr('')
    if (paid > 0 && f.mode !== 'Cash' && !f.ref.trim()) return setErr(f.mode === 'UPI' ? 'Enter the UPI transaction / UTR number' : 'Enter the card slip number or last 4 digits')
    if (!patient && f.phone.trim()) {
      const { data: dup } = await supabase.from('patients').select('name,uhid').eq('phone', f.phone.trim()).limit(1)
      if (dup?.length && !confirm(`A patient with this phone number already exists: ${dup[0].name} (${dup[0].uhid}).\nCreate a new patient anyway?`)) return
    }
    setBusy(true); const { data, error } = await supabase.rpc('register_opd', { p_patient: patient?.id || null, p_name: f.name, p_age: f.age ? +f.age : null, p_sex: f.sex, p_phone: f.phone, p_address: f.address, p_consultant: f.consultant, p_discount: d, p_authority: waived ? f.auO : (f.au === 'Other' ? f.auO : f.au), p_category: f.cat || null, p_paid: paid, p_mode: f.mode, p_father: f.father, p_relation: f.relation, p_ref: f.ref })
    setBusy(false); if (error) return setErr(error.message); onDone(data)
  }
  const I = (k, l, t = 'text', req) => <div><label className="lbl">{l}</label><input className="inp" type={t} required={req} value={f[k]} onChange={set(k)} /></div>
  return <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 backdrop-blur-sm sm:place-items-center sm:p-4">
    <form onSubmit={submit} className="card max-h-[92dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl sm:p-6">
      <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold text-navy">{patient ? `New OPD visit — ${patient.name}` : 'New patient registration'}</h2><button type="button" onClick={onClose}><X /></button></div>
      {!patient && <div className="grid gap-3 sm:grid-cols-2">{I('name', 'Patient name *', 'text', true)}{I('phone', 'Phone', 'tel')}{I('age', 'Age (years)', 'number')}
        <div><label className="lbl">Sex</label><select className="inp" value={f.sex} onChange={set('sex')}><option>Male</option><option>Female</option><option>Other</option></select></div><div className="grid grid-cols-[84px_1fr] gap-2 sm:col-span-2"><div><label className="lbl">Relation</label><select className="inp" value={f.relation} onChange={set('relation')}>{REL.map(r => <option key={r}>{r}</option>)}</select></div>{I('father', 'Father / Husband name')}</div><div className="sm:col-span-2">{I('address', 'Address')}</div></div>}
      <div className="flex items-center justify-between rounded-2xl bg-navy-50 p-4"><div><div className="text-xs font-semibold text-slate-500">OPD consultation fee (automatic)</div><div className="text-[11px] text-slate-400">{why || 'Calculated automatically (India time)'}</div></div><div className="text-3xl font-extrabold text-navy">{inr(fee)}</div></div>
      <div className="grid gap-3 sm:grid-cols-2"><div><label className="lbl">Consultant</label><select className="inp" value={f.consultant} onChange={set('consultant')}>{DOCS.map(x => <option key={x}>{x}</option>)}</select></div><div><label className="lbl">Fee category</label><select className="inp" value={f.cat} onChange={set('cat')}><option value="">Regular (pays fee)</option>{CATS.map(c => <option key={c} value={c}>{c} (fee waived)</option>)}</select></div>{!waived && I('discount', 'Discount (₹)', 'number')}
        {f.cat === 'Other' && <div className="sm:col-span-2"><label className="lbl">Reason / authority for waiver *</label><input className="inp" value={f.auO} onChange={set('auO')} required /></div>}
        {d > 0 && !waived && <div className="sm:col-span-2"><label className="lbl">Discount authority *</label><select className="inp" value={f.au} onChange={set('au')}>{AUTH.map(a => <option key={a}>{a}</option>)}</select>{f.au === 'Other' && <input className="inp mt-2" placeholder="Full name" value={f.auO} onChange={set('auO')} />}</div>}
        {!waived && <><div><label className="lbl">Amount paid (₹)</label><input className="inp" type="number" value={f.paid === '' ? net : f.paid} onChange={set('paid')} /></div>
          <div><label className="lbl">Payment mode</label><select className="inp" value={f.mode} onChange={set('mode')}><option>Cash</option><option>UPI</option><option>Card</option></select></div></>}
        {f.mode !== 'Cash' && paid > 0 && <div className="sm:col-span-2"><label className="lbl">{f.mode === 'UPI' ? 'UPI Txn / UTR number *' : 'Card slip no. or last 4 digits *'}</label><input className="inp" value={f.ref} onChange={set('ref')} />{f.mode === 'Card' && <p className="mt-1 text-[11px] text-slate-400">Never enter the full card number.</p>}</div>}</div>
      <div className="flex justify-between text-sm"><span className="text-slate-500">Net payable {inr(net)}</span><span className={paid < net ? 'font-semibold text-red-600' : 'font-semibold text-emerald-600'}>Balance {inr(Math.max(0, net - paid))}</span></div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? 'Saving…' : 'Register & print receipt'}</button></form></div>
}