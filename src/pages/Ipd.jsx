import { useEffect, useState } from 'react'
import { Search, X, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ProcedurePick from '../components/ProcedurePick'
const PROC = ['Phaco with foldable IOL', 'SICS', 'Pterygium surgery', 'Trabeculectomy', 'Vitrectomy', 'DCR', 'Squint surgery', 'Corneal transplant', 'Intravitreal injection']
const CATS = ['Cash', 'Insurance', 'Government scheme', 'Other']
const F0 = { procedure: '', side: 'OS', surgeon: 'Dr Akhil Batra', bed_id: '', preop: 'Fit for surgery', category: 'Cash', refer_no: '', planned_date: '', advance: '', mode: 'now', addCharge: true }
const days = d => Math.max(1, Math.ceil((Date.now() - new Date(d)) / 864e5))
const DSTATUS = ['Discharged to Home', 'Referred to another hospital', 'LAMA (Left against medical advice)', 'DAMA (Discharged on request)', 'Absconded', 'Expired']
export default function Ipd({ profile }) {
  const canWrite = ['Doctor', 'Admin', 'Super Admin'].includes(profile?.role), isAdm = ['Admin', 'Super Admin'].includes(profile?.role)
  const [tab, setTab] = useState('beds'), [beds, setBeds] = useState([]), [adm, setAdm] = useState([]), [f, setF] = useState(F0), [q, setQ] = useState(''), [res, setRes] = useState([]), [pt, setPt] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [nb, setNb] = useState({ ward: '', bed_no: '' }), [pick, setPick] = useState({}), [tr, setTr] = useState(null), [trBed, setTrBed] = useState(''), [cat, setCat] = useState([])
  const load = async () => {
    const [b, a] = await Promise.all([supabase.from('beds').select('*').eq('active', true),
    supabase.from('admissions').select('*, patients(name,uhid,age,sex), beds(bed_no,ward)').in('status', ['Admitted', 'Booked']).order('created_at', { ascending: false })])
    setBeds((b.data || []).sort((x, y) => x.ward.localeCompare(y.ward) || x.bed_no.localeCompare(y.bed_no, undefined, { numeric: true }))); setAdm(a.data || [])
  }
  useEffect(() => { load(); const ch = supabase.channel('ipd').on('postgres_changes', { event: '*', schema: 'public', table: 'admissions' }, load).subscribe(); const iv = setInterval(load, 20000); return () => { supabase.removeChannel(ch); clearInterval(iv) } }, [])
  useEffect(() => { if (!q.trim()) { setRes([]); return }; const t = setTimeout(async () => { const { data } = await supabase.from('patients').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%,uhid.ilike.%${q}%`).limit(6); setRes(data || []) }, 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { supabase.from('catalog_items').select('name,rate').eq('kind', 'ipd_procedure').eq('active', true).order('name').then(({ data }) => setCat(data || [])) }, [])
  const rate = (cat.find(c => c.name.toLowerCase() === f.procedure.trim().toLowerCase()) || {}).rate, canBillRole = false
  const adm_ = adm.filter(a => a.status === 'Admitted'), occ = Object.fromEntries(adm_.map(a => [a.bed_id, a])), isFree = b => b.multi || !occ[b.id]
  const wards = [...new Set(beds.map(b => b.ward))], freeBeds = beds.filter(isFree), set = k => e => setF({ ...f, [k]: e.target.value }), occN = beds.filter(b => !b.multi && occ[b.id]).length
  useEffect(() => { const d = freeBeds[0]; if (d && !f.bed_id && f.mode === 'now') setF(x => ({ ...x, bed_id: d.id })) }, [beds, adm, f.bed_id, f.mode])
  const save = async () => {
    setErr(''); const book = f.mode === 'book'
    if (!pt) return setErr('Select a patient'); if (!f.procedure.trim()) return setErr('Enter the procedure')
    const dup = adm.find(a => a.patient_id === pt.id); if (dup && !confirm(`${pt.name} already has an active admission ${dup.adm_no} (${dup.procedure}, ${dup.status}).\n\nTo correct the procedure, eye, category or number, cancel this and use Edit on the existing admission instead.\nDo you really want to create another admission?`)) return
    if (book && !f.planned_date) return setErr('Enter the planned date'); if (!book && !f.bed_id) return setErr('Select a bed')
    setBusy(true); const { data: ins, error } = await supabase.from('admissions').insert({
      patient_id: pt.id, procedure: f.procedure.trim(), side: f.side, surgeon: f.surgeon, bed_id: f.bed_id || null, preop: f.preop, category: f.category,
      refer_no: f.refer_no || null, planned_date: book ? f.planned_date : null, advance: +f.advance || 0, status: book ? 'Booked' : 'Admitted'
    }).select('id').single(); setBusy(false)
    if (error) return setErr(error.message)
    setPt(null); setQ(''); setF(F0); setTab('beds'); load()
  }
  const act = async (a, patch, ask) => {
    if (ask && !confirm(ask)) return false; const { data, error } = await supabase.from('admissions').update(patch).eq('id', a.id).select('id')
    if (error) { alert(error.message); return false } if (!data.length) { alert('You do not have permission to change this admission.'); return false } load(); return true
  }
  const [dis, setDis] = useState(null), [ed, setEd] = useState(null), [edErr, setEdErr] = useState('')
  const discharge = async a => {
    const { data } = await supabase.from('bills').select('total,paid').eq('admission_id', a.id).neq('status', 'Cancelled'); const bal = (data || []).reduce((s, b) => s + Number(b.total) - Number(b.paid), 0)
    setDis({ a, bal, status: DSTATUS[0] })
  }
  const doDischarge = async () => { const ok = await act(dis.a, { status: 'Discharged', discharged_at: new Date().toISOString(), discharge_status: dis.status }); if (ok) setDis(null) }
  const openEd = a => { setEd({ a, procedure: a.procedure || '', side: a.side || 'OS', surgeon: a.surgeon || '', category: a.category || 'Cash', refer_no: a.refer_no || '', planned_date: a.planned_date || '' }); setEdErr('') }
  const saveEd = async () => {
    if (!ed.procedure.trim()) return setEdErr('Enter the procedure'); const patch = { procedure: ed.procedure.trim(), side: ed.side, surgeon: ed.surgeon, category: ed.category, refer_no: ed.refer_no || null }; if (ed.a.status === 'Booked' && ed.planned_date) patch.planned_date = ed.planned_date
    const ok = await act(ed.a, patch); if (ok) setEd(null)
  }
  const cancelAdm = async a => {
    const reason = prompt(`Cancel admission ${a.adm_no} of ${a.patients?.name}?\nUse this only for a wrong entry. If the same patient is added again today, the same IPD number is used.\nEnter a reason (required):`); if (!reason?.trim()) return
    const { data, error } = await supabase.rpc('cancel_admission', { p_adm: a.id, p_reason: reason.trim() }); if (error) return alert(error.message)
    if (data?.advance > 0) alert(`Admission cancelled. An advance of ₹${data.advance} was received on it. If you add this patient again today it moves to the new admission automatically; otherwise refund it from Money Receipt.`); load()
  }
  const doTransfer = async () => { if (!trBed) return; if (await act(tr, { bed_id: trBed })) { setTr(null); setTrBed('') } }
  const addBed = async () => { if (!nb.ward.trim() || !nb.bed_no.trim()) return; const { error } = await supabase.from('beds').insert({ ward: nb.ward.trim(), bed_no: nb.bed_no.trim() }); if (error) alert(error.message); else { setNb({ ward: '', bed_no: '' }); load() } }
  const Row = ({ a }) => <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 text-sm sm:px-5"><div className="min-w-0 flex-1"><b>{a.patients?.name}</b> <span className="text-xs text-slate-400">{a.patients?.uhid} · {a.adm_no}</span>
    <div className="text-xs text-slate-500">{a.procedure} ({a.side}) · {a.surgeon} · {a.category}{a.refer_no && ' · ' + a.refer_no}</div></div>
    {a.status === 'Admitted' ? <><span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700">{a.beds?.bed_no || 'No bed'}</span>{canWrite && <><button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600" onClick={() => openEd(a)}>Edit</button><button className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600" onClick={() => { setTr(a); setTrBed('') }}>Transfer</button><button className="text-xs text-slate-400" onClick={() => cancelAdm(a)}>Cancel</button><button className="btn !py-1.5 !text-xs" onClick={() => discharge(a)}>Discharge</button></>}</>
      : <><span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-accent">Booked {a.planned_date}</span>{canWrite && <><select className="inp !w-36 !py-1.5" value={pick[a.id] || ''} onChange={e => setPick({ ...pick, [a.id]: e.target.value })}><option value="">Bed…</option>{freeBeds.map(b => <option key={b.id} value={b.id}>{b.bed_no}</option>)}</select>
        <button className="btn !py-1.5 !text-xs" onClick={() => pick[a.id] ? act(a, { status: 'Admitted', bed_id: pick[a.id] }) : alert('Select a bed first')}>Admit</button><button className="text-xs text-slate-400" onClick={() => cancelAdm(a)}>Cancel</button><button className="text-xs font-semibold text-accent" onClick={() => openEd(a)}>Edit</button></>}</>}</div>
  return <div className="space-y-4"><div className="flex gap-2">{[['beds', 'Bed map'], ['admit', 'New admission'], ['list', 'Admissions']].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-navy text-white' : 'bg-white text-slate-500'}`}>{l}</button>)}</div>
    {tab === 'beds' && <div className="space-y-4"><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-700">Occupied {occN}</span><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-700">Free {beds.length - occN}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">Total {beds.length}</span></div>
      {wards.map(w => <div key={w} className="card p-4 sm:p-5"><h3 className="mb-3 font-extrabold text-navy">{w}</h3><div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {beds.filter(b => b.ward === w).map(b => {
          const o = occ[b.id]; return o && !b.multi
            ? <div key={b.id} className="rounded-xl border-2 border-rose-300 bg-rose-50 p-2.5 shadow-sm"><div className="flex items-center justify-between gap-1"><b className="text-sm text-rose-800">{b.bed_no}</b><span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white">OCCUPIED</span></div>
              <div className="mt-1 truncate text-xs font-bold text-slate-800">{o.patients?.name}</div><div className="truncate text-[10px] text-slate-500">{o.procedure} · Day {days(o.admitted_at)}</div><div className="truncate text-[10px] text-slate-400">{o.adm_no}</div>
              {canWrite && <div className="mt-1.5 flex gap-1"><button onClick={() => openEd(o)} className="flex-1 rounded-lg bg-white px-1 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-rose-200">Edit</button><button onClick={() => { setTr(o); setTrBed('') }} className="flex-1 rounded-lg bg-white px-1 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-rose-200">Transfer</button><button onClick={() => discharge(o)} className="flex-1 rounded-lg bg-rose-600 px-1 py-1 text-[10px] font-semibold text-white">Discharge</button></div>}</div>
            : <button key={b.id} disabled={!canWrite} onClick={() => { setF({ ...F0, bed_id: b.id }); setTab('admit') }} className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-2.5 text-left transition hover:border-emerald-400"><b className="text-sm text-emerald-800">{b.bed_no}</b><div className="mt-1 text-xs font-semibold text-emerald-600">Free</div><div className="text-[10px] text-emerald-500">Tap to admit</div></button>
        })}</div></div>)}
      {isAdm && <div className="card flex flex-wrap items-end gap-3 p-5"><div><label className="lbl">Ward</label><input className="inp" value={nb.ward} onChange={e => setNb({ ...nb, ward: e.target.value })} placeholder="Daycare" /></div><div><label className="lbl">Bed no.</label><input className="inp" value={nb.bed_no} onChange={e => setNb({ ...nb, bed_no: e.target.value })} placeholder="Daycare51" /></div><button className="btn" onClick={addBed}><Plus size={16} />Add bed</button></div>}</div>}
    {tab === 'admit' && <div className="card max-w-2xl space-y-4 p-5 sm:p-6">{!canWrite && <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">Your role cannot create admissions.</p>}
      <div><label className="lbl">Patient</label>{pt ? <div className="flex items-center justify-between rounded-xl bg-navy-50 p-3"><div><b>{pt.name}</b><div className="text-xs text-slate-500">{pt.uhid} · {pt.phone}</div></div><button onClick={() => setPt(null)}><X size={16} /></button></div>
        : <><div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400" /><input className="inp pl-10" placeholder="Name / phone / UHID" value={q} onChange={e => setQ(e.target.value)} /></div>{res.map(p => <button key={p.id} onClick={() => setPt(p)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-400">{p.uhid}</span></button>)}</>}</div>
      <div className="flex gap-2">{[['now', 'Admit now'], ['book', 'Book for later']].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, mode: k })} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${f.mode === k ? 'border-accent bg-accent text-white' : 'border-slate-200 text-slate-500'}`}>{l}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2"><label className="lbl">Procedure *</label><ProcedurePick items={cat} value={f.procedure} onChange={v => setF({ ...f, procedure: v })} onPick={c => setF({ ...f, procedure: c.name })} placeholder="Click to choose a procedure, or type to search" />{f.mode === 'now' && f.procedure.trim() && <p className="mt-1.5 text-xs text-slate-500">{rate > 0 ? `Charge ₹${rate} will be added to the IPD bill automatically.` : 'No charge is listed for this procedure. The billing desk will enter it in IPD Final Bill.'}</p>}</div>
        <div><label className="lbl">Eye</label><select className="inp" value={f.side} onChange={set('side')}><option>OD</option><option>OS</option><option>OU</option></select></div><div><label className="lbl">Surgeon</label><input className="inp" value={f.surgeon} onChange={set('surgeon')} /></div>
        {f.mode === 'book' ? <div><label className="lbl">Planned date *</label><input type="date" className="inp" value={f.planned_date} onChange={set('planned_date')} /></div>
          : <div><label className="lbl">Bed *</label><select className="inp" value={f.bed_id} onChange={set('bed_id')}><option value="">Select…</option>{freeBeds.map(b => <option key={b.id} value={b.id}>{b.bed_no}</option>)}</select></div>}
        <div><label className="lbl">Pre-op status</label><input className="inp" value={f.preop} onChange={set('preop')} /></div>
        <div><label className="lbl">Category</label><select className="inp" value={f.category} onChange={set('category')}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div><div><label className="lbl">Reference / policy no.</label><input className="inp" value={f.refer_no} onChange={set('refer_no')} /></div></div>
      <p className="text-xs text-slate-400">Advance payments and services are recorded in Billing → Patient account, using the IPD number.</p>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}<button className="btn w-full" disabled={busy || !canWrite} onClick={save}>{busy ? 'Saving…' : f.mode === 'book' ? 'Save booking' : 'Admit patient'}</button></div>}
    {tab === 'list' && <div className="card divide-y divide-slate-100">{adm.length === 0 && <p className="p-10 text-center text-sm text-slate-400">No admitted or booked patients right now.</p>}{adm.map(a => <Row key={a.id} a={a} />)}</div>}
    {ed && <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 backdrop-blur-sm sm:place-items-center sm:p-4"><div className="card max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-b-none p-5 sm:rounded-b-2xl"><div className="flex items-center justify-between"><h2 className="font-extrabold text-navy">Edit admission · {ed.a.adm_no}</h2><button onClick={() => setEd(null)}><X /></button></div>
      <p className="text-xs text-slate-500">{ed.a.patients?.name}. The IPD number stays the same. If the procedure changes, its charge on the bill is updated automatically.</p>
      <div><label className="lbl">Procedure *</label><ProcedurePick items={cat} value={ed.procedure} onChange={v => setEd({ ...ed, procedure: v })} onPick={c => setEd({ ...ed, procedure: c.name })} placeholder="Click to choose a procedure, or type to search" /></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="lbl">Eye</label><select className="inp" value={ed.side} onChange={e => setEd({ ...ed, side: e.target.value })}><option>OD</option><option>OS</option><option>OU</option></select></div><div><label className="lbl">Surgeon</label><input className="inp" value={ed.surgeon} onChange={e => setEd({ ...ed, surgeon: e.target.value })} /></div>
        <div><label className="lbl">Category</label><select className="inp" value={ed.category} onChange={e => setEd({ ...ed, category: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div><div><label className="lbl">Reference / policy no.</label><input className="inp" value={ed.refer_no} onChange={e => setEd({ ...ed, refer_no: e.target.value })} /></div>
        {ed.a.status === 'Booked' && <div className="col-span-2"><label className="lbl">Planned date</label><input type="date" className="inp" value={ed.planned_date} onChange={e => setEd({ ...ed, planned_date: e.target.value })} /></div>}</div>
      {edErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{edErr}</p>}<button className="btn w-full" onClick={saveEd}>Save changes</button></div></div>}
    {dis && <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 backdrop-blur-sm sm:place-items-center sm:p-4"><div className="card w-full max-w-sm space-y-3 rounded-b-none p-5 sm:rounded-b-2xl"><div className="flex items-center justify-between"><h2 className="font-extrabold text-navy">Discharge {dis.a.patients?.name}</h2><button onClick={() => setDis(null)}><X /></button></div>
      {dis.bal > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">₹{dis.bal} is still pending. Use <b>IPD Final Bill</b> to settle it and discharge in one step.</p>}{dis.bal < 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">₹{-dis.bal} of advance is unused (refund due).</p>}
      <div><label className="lbl">Patient status</label><select className="inp" value={dis.status} onChange={e => setDis({ ...dis, status: e.target.value })}>{DSTATUS.map(x => <option key={x}>{x}</option>)}</select></div><button className="btn w-full" onClick={doDischarge}>Confirm discharge</button></div></div>}
    {tr && <div className="fixed inset-0 z-40 grid place-items-end bg-slate-900/40 backdrop-blur-sm sm:place-items-center sm:p-4"><div className="card w-full max-w-sm space-y-3 rounded-b-none p-5 sm:rounded-b-2xl"><div className="flex items-center justify-between"><h2 className="font-extrabold text-navy">Transfer bed</h2><button onClick={() => setTr(null)}><X /></button></div>
      <p className="text-sm text-slate-500"><b>{tr.patients?.name}</b> · now in {tr.beds?.bed_no || 'no bed'}</p><select className="inp" value={trBed} onChange={e => setTrBed(e.target.value)}><option value="">Select a free bed…</option>{freeBeds.filter(b => b.id !== tr.bed_id).map(b => <option key={b.id} value={b.id}>{b.bed_no}</option>)}</select><button className="btn w-full" disabled={!trBed} onClick={doTransfer}>Confirm transfer</button></div></div>}</div>
}