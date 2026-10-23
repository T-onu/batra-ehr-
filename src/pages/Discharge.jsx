import { useEffect, useState } from 'react'
import { Save, Printer, Plus, Trash2, Wand2, X } from 'lucide-react'
import { supabase, today } from '../lib/supabase'
const ee = () => ({ od: '', os: '' })
const blank = () => ({
  doa: '', dos: '', dod: today(), consultant: '', eye: '', diagnosis: '', complaints: '', ocularHx: '',
  med: { diabetes: false, hypertension: false, cardiac: false, asthma: false, thyroid: false, allergy: false }, medOther: '',
  ucva: ee(), bcva: ee(), iop: ee(), slit: ee(), fundus: ee(), investigations: '', procedure: '', anaesthesia: { topical: false, local: false, peribulbar: false, general: false }, intraop: '',
  vision: ee(), quiet: true, noComp: true, meds: [{ n: '', eye: '', dose: '', freq: '', days: '' }], followup: '', followup2: '', status: '', remarks: ''
})
const MED = [['diabetes', 'Diabetes'], ['hypertension', 'Hypertension'], ['cardiac', 'Cardiac Disease'], ['asthma', 'Asthma'], ['thyroid', 'Thyroid Disease'], ['allergy', 'Drug Allergy']]
const ANA = [['topical', 'Topical'], ['local', 'Local'], ['peribulbar', 'Peribulbar'], ['general', 'General']]
const dmy = d => d ? new Date(d).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }) : ''
const day = x => x ? new Date(x).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : ''
const SIDE = { OD: 'Right eye (OD)', OS: 'Left eye (OS)', OU: 'Both eyes (OU)' }
const merge = (base, saved) => {
  const b = blank(); return {
    ...b, ...base, ...saved, med: { ...b.med, ...(saved?.med || {}) }, anaesthesia: { ...b.anaesthesia, ...(saved?.anaesthesia || {}) },
    ucva: { ...b.ucva, ...(saved?.ucva || {}) }, bcva: { ...b.bcva, ...(saved?.bcva || {}) }, iop: { ...b.iop, ...(saved?.iop || {}) }, slit: { ...b.slit, ...(saved?.slit || {}) }, fundus: { ...b.fundus, ...(saved?.fundus || {}) }, vision: { ...b.vision, ...(saved?.vision || {}) },
    meds: saved?.meds?.length ? saved.meds.map(m => ({ eye: '', ...m })) : b.meds,
    procedure: saved?.procedure ?? b.procedure, intraop: saved?.intraop ?? saved?.notes ?? '', remarks: saved?.remarks ?? '', followup: saved?.followup ?? '', diagnosis: saved?.diagnosis ?? ''
  }
}
const Cb = ({ on }) => <span className="mr-1 inline-block h-[10px] w-[10px] border border-slate-700 text-center align-[-1px] text-[9px] font-bold leading-[9px]">{on ? '✓' : ''}</span>
export default function Discharge({ profile }) {
  const canEdit = ['Doctor', 'Admin', 'Super Admin'].includes(profile?.role)
  const [list, setList] = useState([]), [sel, setSel] = useState(null), [f, setF] = useState(blank()), [msg, setMsg] = useState(''), [show, setShow] = useState(false), [drugs, setDrugs] = useState([]), [q, setQ] = useState('')
  useEffect(() => {
    supabase.from('admissions').select('*, patients(name,uhid,age,sex,phone,address,father_name,relation), beds(bed_no,ward)').in('status', ['Admitted', 'Discharged']).order('created_at', { ascending: false }).limit(60).then(({ data }) => setList(data || []))
    supabase.from('stock_items').select('product').eq('module', 'pharmacy').limit(500).then(({ data }) => setDrugs([...new Set((data || []).map(x => x.product))].sort()))
  }, [])
  // Everything that already exists in the records for this admission (the doctor can change any of it)
  const fromRecords = async a => {
    const [{ data: ex }, { data: inv }] = await Promise.all([supabase.from('exams').select('doctor,data,created_at').eq('patient_id', a.patient_id).order('created_at', { ascending: false }).limit(1),
    supabase.from('investigations').select('name,created_at,admission_id,context').eq('patient_id', a.patient_id).order('created_at', { ascending: false }).limit(30)])
    const e = ex?.[0]?.data || {}, sd = a.side || '', sys = `${e.systemic || ''} ${e.pastHistory || ''}`.toLowerCase(), has = r => r.test(sys)
    const slit = Object.entries({ Lids: e.slit?.lids, Conjunctiva: e.slit?.conj, Cornea: e.slit?.cornea, AC: e.slit?.ac, Iris: e.slit?.iris, Pupil: e.slit?.pupil, Lens: e.slit?.lens }).filter(x => x[1]).map(x => x.join(': ')).join('; ')
    const sl = { od: sd === 'OD' || sd === 'OU' ? slit : '', os: sd === 'OS' || sd === 'OU' ? slit : '' }
    const invs = (inv || []).filter(x => x.admission_id === a.id || (Date.now() - new Date(x.created_at)) < 30 * 864e5).map(x => x.name)
    return {
      doa: day(a.admitted_at), dos: a.planned_date || day(a.admitted_at), dod: a.discharged_at ? day(a.discharged_at) : today(), consultant: a.surgeon || ex?.[0]?.doctor || '', eye: sd,
      diagnosis: e.diagnosis || '', complaints: e.complaints || '', ocularHx: e.pastHistory || '',
      med: { diabetes: has(/diabet|sugar|\bdm\b/), hypertension: has(/hypertens|\bhtn\b|\bbp\b|blood pressure/), cardiac: has(/cardiac|heart|\bcad\b/), asthma: has(/asthma/), thyroid: has(/thyroid/), allergy: has(/allerg/) },
      ucva: { od: e.vision?.dist?.od || '', os: e.vision?.dist?.os || '' }, iop: { od: e.iop?.od || '', os: e.iop?.os || '' }, slit: sl, fundus: { od: e.fundus?.od || '', os: e.fundus?.os || '' },
      investigations: [...new Set(invs)].join(', '), procedure: `${a.procedure || ''}${sd ? ' (' + sd + ')' : ''}`.trim()
    }
  }
  const open = async a => {
    setSel(a); setMsg(''); const [{ data: sv }, rec] = await Promise.all([supabase.from('discharge_summaries').select('*').eq('admission_id', a.id).maybeSingle(), fromRecords(a)])
    if (sv) { const x = merge({}, sv.data); setF(sv.data?.doa || sv.data?.eye ? x : fillEmpty(x, rec, true)) } else setF(merge(rec, {}))
  }
  // fill only the blank fields, never overwrite what the doctor has typed
  function fillEmpty(cur, rec, silent) { const o = structuredClone(cur), walk = (c, r) => { Object.keys(r).forEach(k => { if (r[k] && typeof r[k] === 'object' && !Array.isArray(r[k])) { c[k] = c[k] || {}; walk(c[k], r[k]) } else if (typeof r[k] === 'boolean') { if (r[k] && !c[k]) c[k] = true } else if (r[k] && !c[k]) c[k] = r[k] }) }; walk(o, rec); if (!silent) setMsg('Blank fields filled from the patient record ✓'); return o }
  const set = (path, val) => setF(p => { const n = structuredClone(p); let o = n; path.slice(0, -1).forEach(k => o = o[k]); o[path.at(-1)] = val; return n })
  const med = (i, k, v) => setF(p => ({ ...p, meds: p.meds.map((m, j) => j === i ? { ...m, [k]: v } : m) }))
  const save = async () => { const { error } = await supabase.from('discharge_summaries').upsert({ admission_id: sel.id, patient_id: sel.patient_id, doctor: f.consultant, data: f, updated_at: new Date().toISOString() }, { onConflict: 'admission_id' }); setMsg(error ? 'Error: ' + error.message : 'Saved ✓') }
  const val = path => path.reduce((o, k) => o?.[k], f) ?? ''
  const In = (l, path, t = 'text', cls = '') => <div className={cls}><label className="lbl">{l}</label><input type={t} className="inp" disabled={!canEdit} value={val(path)} onChange={e => set(path, e.target.value)} /></div>
  const Tx = (l, path, r = 2, cls = '') => <div className={cls}><label className="lbl">{l}</label><textarea rows={r} className="inp" disabled={!canEdit} value={val(path)} onChange={e => set(path, e.target.value)} /></div>
  const Ck = (l, path) => <label key={l} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={!!val(path)} onChange={e => set(path, e.target.checked)} />{l}</label>
  const Sec = ({ t, children }) => <div className="card space-y-3 p-5"><h3 className="font-extrabold text-navy">{t}</h3>{children}</div>
  if (!sel) {
    const s = q.trim().toLowerCase(), rows = list.filter(a => !s || `${a.patients?.name} ${a.patients?.uhid} ${a.adm_no} ${a.legacy_no || ''} ${a.patients?.phone || ''}`.toLowerCase().includes(s))
    return <div className="space-y-3"><p className="text-sm text-slate-500">Select an admitted or discharged patient to create or print the discharge summary. Details already in the record are filled in automatically.</p>
      <input className="inp" placeholder="Search by name, UHID, IPD no. or phone" value={q} onChange={e => setQ(e.target.value)} />
      <div className="card divide-y divide-slate-100">{rows.length === 0 && <p className="p-10 text-center text-sm text-slate-400">No admissions found.</p>}
        {rows.map(a => <button key={a.id} onClick={() => open(a)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50"><span className="flex-1"><b className="block text-sm">{a.patients?.name}</b><span className="text-xs text-slate-400">{a.adm_no} · {a.procedure} ({a.side})</span></span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${a.status === 'Admitted' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{a.status}</span></button>)}</div></div>
  }
  const p = sel.patients, od = f.eye === 'OD' || f.eye === 'OU', os = f.eye === 'OS' || f.eye === 'OU'
  const EyeRow = (l, key) => <div className="grid grid-cols-[110px_1fr_1fr] items-center gap-2 text-sm"><span className="font-semibold text-slate-600">{l}</span>{['od', 'os'].map(s => <input key={s} className="inp !px-2" placeholder={s.toUpperCase()} disabled={!canEdit} value={f[key][s]} onChange={e => set([key, s], e.target.value)} />)}</div>
  const medRows = [...f.meds.filter(m => m.n || m.dose || m.freq || m.days)]; while (medRows.length < 5) medRows.push({})
  return <div className="space-y-4"><datalist id="drugs">{drugs.map(d => <option key={d}>{d}</option>)}</datalist>
    <div className="card flex items-center gap-3 bg-gradient-to-r from-navy to-accent p-5 text-white"><div className="flex-1"><div className="text-xs text-blue-100">{p.uhid} · {sel.adm_no}{sel.legacy_no ? ` · old ${sel.legacy_no}` : ''}</div><div className="text-xl font-extrabold">{p.name}</div><div className="text-xs text-blue-100">{sel.procedure} ({sel.side})</div></div>
      <button className="rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold" onClick={() => setSel(null)}>← List</button></div>
    {!canEdit && <p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">Only Doctors and Admins can edit the summary. You can still view and print it.</p>}
    {canEdit && <button className="btn !bg-white !text-navy ring-1 ring-slate-200" onClick={async () => setF(fillEmpty(f, await fromRecords(sel)))}><Wand2 size={16} />Auto-fill blank fields from patient record</button>}
    <Sec t="Admission details"><div className="grid gap-3 sm:grid-cols-4">{In('Date of admission', ['doa'], 'date')}{In('Date of surgery', ['dos'], 'date')}{In('Date of discharge', ['dod'], 'date')}{In('Consultant', ['consultant'])}</div>
      <div><label className="lbl">Eye operated</label><div className="flex flex-wrap gap-4">{[['OD', 'Right Eye (OD)'], ['OS', 'Left Eye (OS)'], ['OU', 'Both Eyes (OU)']].map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="eye" disabled={!canEdit} checked={f.eye === k} onChange={() => set(['eye'], k)} />{l}</label>)}</div></div></Sec>
    <Sec t="Diagnosis & history"><div className="grid gap-3 sm:grid-cols-3">{Tx('Final diagnosis', ['diagnosis'], 3)}{Tx('Presenting complaints', ['complaints'], 3)}{Tx('Relevant ocular history', ['ocularHx'], 3)}</div>
      <div><label className="lbl">Medical history</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{MED.map(([k, l]) => Ck(l, ['med', k]))}</div></div>{In('Other medical history', ['medOther'])}</Sec>
    <Sec t="Examination on admission"><div className="grid grid-cols-[110px_1fr_1fr] gap-2 text-center text-xs font-bold text-slate-500"><span /><span>OD (Right)</span><span>OS (Left)</span></div>
      {EyeRow('UCVA', 'ucva')}{EyeRow('BCVA', 'bcva')}{EyeRow('IOP (mmHg)', 'iop')}{EyeRow('Slit lamp', 'slit')}{EyeRow('Fundus', 'fundus')}</Sec>
    <Sec t="Procedure"><div className="grid gap-3 sm:grid-cols-2">{Tx('Relevant investigations', ['investigations'], 2)}{Tx('Procedure performed', ['procedure'], 2)}</div>
      <div><label className="lbl">Anaesthesia</label><div className="flex flex-wrap gap-4">{ANA.map(([k, l]) => Ck(l, ['anaesthesia', k]))}</div></div>{Tx('Intraoperative findings / complications', ['intraop'], 2)}</Sec>
    <Sec t="Condition at discharge"><div className="grid grid-cols-[110px_1fr_1fr] gap-2 text-center text-xs font-bold text-slate-500"><span /><span>OD (Right)</span><span>OS (Left)</span></div>{EyeRow('Vision at discharge', 'vision')}
      <div className="flex flex-wrap gap-4">{Ck('Eye quiet / dressing done / eye shield applied', ['quiet'])}{Ck('No immediate postoperative complications', ['noComp'])}</div>
      <div><label className="lbl">Condition at discharge</label><div className="flex flex-wrap gap-4">{['Stable', 'Improved', 'Satisfactory'].map(k => <label key={k} className="flex items-center gap-2 text-sm"><input type="radio" name="st" disabled={!canEdit} checked={f.status === k} onChange={() => set(['status'], k)} />{k}</label>)}</div></div></Sec>
    <Sec t="Discharge medications">
      {f.meds.map((m, i) => <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_70px_70px_90px_90px_28px]"><input list="drugs" className="inp col-span-2 !px-2 sm:col-span-1" placeholder="Medication" disabled={!canEdit} value={m.n} onChange={e => med(i, 'n', e.target.value)} />
        {[['eye', 'Eye'], ['dose', 'Dose'], ['freq', 'Frequency'], ['days', 'Duration']].map(([k, ph]) => <input key={k} className="inp !px-2" placeholder={ph} disabled={!canEdit} value={m[k] || ''} onChange={e => med(i, k, e.target.value)} />)}
        <button disabled={!canEdit} onClick={() => setF({ ...f, meds: f.meds.length > 1 ? f.meds.filter((_, j) => j !== i) : f.meds })} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></div>)}
      {canEdit && <button className="text-xs font-semibold text-accent" onClick={() => setF({ ...f, meds: [...f.meds, { n: '', eye: f.eye === 'OD' ? 'RE' : f.eye === 'OS' ? 'LE' : f.eye === 'OU' ? 'BE' : '', dose: '', freq: '', days: '' }] })}><Plus size={12} className="inline" /> Add medication</button>}</Sec>
    <Sec t="Follow-up & remarks"><div className="grid gap-3 sm:grid-cols-2">{In('First review on', ['followup'])}{In('Subsequent review', ['followup2'])}</div>{Tx("Consultant's remarks", ['remarks'], 3)}</Sec>
    <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 backdrop-blur md:bottom-4"><span className="flex-1 text-xs font-medium text-emerald-600">{msg}</span>
      {canEdit && <button className="btn" onClick={save}><Save size={16} />Save</button>}<button className="btn !bg-emerald-600" onClick={() => setShow(true)}><Printer size={16} />Print summary</button></div>
    {show && <div className="fixed inset-0 z-40 overflow-auto bg-slate-900/50 p-4 backdrop-blur-sm"><style>{'@media print{@page{size:A4;margin:7mm}}'}</style><div className="mx-auto max-w-[210mm]">
      <div className="no-print mb-3 flex justify-end gap-2"><button className="btn" onClick={() => window.print()}><Printer size={16} />Print / PDF</button><button className="btn !bg-white !text-navy" onClick={() => setShow(false)}><X size={16} />Close</button></div>
      <div className="print-area space-y-1.5 bg-white p-5 text-[10px] leading-snug text-slate-900">
        <div className="text-center"><div className="flex items-center justify-center gap-3"><img src="/logo.png" width="46" height="46" className="rounded-full" alt="" /><div className="text-[20px] font-extrabold uppercase tracking-wide text-slate-700">Dr. Batra's Eye Hospital &amp; Laser Centre</div></div>
          <div className="text-[10px] text-slate-600">Bhangala Chungi, Mukerian · 84278-08384, 82959-54631</div></div>
        <div className="mx-auto w-3/4 rounded-full bg-slate-700 py-0.5 text-center text-[12px] font-bold tracking-wide text-white">OPHTHALMOLOGY DISCHARGE SUMMARY</div>
        <div className="grid grid-cols-[1.5fr_1fr] gap-3 rounded-lg border border-slate-600 p-2"><div className="space-y-0.5"><div>Patient Name: <b>{p.name}</b></div><div>Age / Sex: <b>{p.age ? p.age + ' Y' : '—'} / {p.sex || '—'}</b>{p.father_name && <span className="ml-3">{p.relation || 'S/O'}: <b>{p.father_name}</b></span>}</div><div>UHID / IPD No.: <b>{p.uhid} / {sel.adm_no}</b></div><div>Address: <b>{p.address || '—'}</b></div><div>Mobile No.: <b>{p.phone || '—'}</b></div></div>
          <div className="space-y-0.5"><div>Date of Admission: <b>{dmy(f.doa)}</b></div><div>Date of Surgery: <b>{dmy(f.dos)}</b></div><div>Date of Discharge: <b>{dmy(f.dod)}</b></div><div>Consultant: <b>{f.consultant}</b></div></div></div>
        <div className="grid grid-cols-[1fr_1.5fr] gap-2"><div className="rounded border border-slate-600 p-1.5"><b>EYE OPERATED</b><div className="mt-0.5 flex flex-wrap gap-x-3"><span><Cb on={f.eye === 'OD'} />Right Eye (OD)</span><span><Cb on={f.eye === 'OS'} />Left Eye (OS)</span><span><Cb on={f.eye === 'OU'} />Both Eyes (OU)</span></div></div>
          <div className="rounded border border-slate-600 p-1.5"><b>FINAL DIAGNOSIS</b><div className="whitespace-pre-line">{f.diagnosis}</div></div></div>
        <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2"><div className="min-h-[46px] rounded border border-slate-600 p-1.5"><b>PRESENTING COMPLAINTS</b><div className="whitespace-pre-line">{f.complaints}</div></div><div className="min-h-[46px] rounded border border-slate-600 p-1.5"><b>RELEVANT OCULAR HISTORY</b><div className="whitespace-pre-line">{f.ocularHx}</div></div>
          <div className="rounded border border-slate-600 p-1.5"><b>MEDICAL HISTORY</b><div className="mt-0.5 grid grid-cols-3 gap-x-2">{MED.map(([k, l]) => <span key={k}><Cb on={f.med[k]} />{l}</span>)}</div><div className="mt-0.5">Other: {f.medOther}</div></div></div>
        <div className="rounded border border-slate-600 p-1.5"><b>EXAMINATION ON ADMISSION</b>
          <div className="mt-1 grid grid-cols-[1fr_1.2fr] gap-3"><div><b>1. VISUAL ACUITY</b><table className="mt-0.5 w-full border-collapse text-center"><thead><tr>{['Eye', 'UCVA', 'BCVA'].map(h => <th key={h} className="border border-slate-500 p-0.5">{h}</th>)}</tr></thead><tbody>{[['Right (OD)', 'od'], ['Left (OS)', 'os']].map(([l, k]) => <tr key={k}><td className="border border-slate-500 p-0.5 font-semibold">{l}</td><td className="border border-slate-500 p-0.5">{f.ucva[k]}</td><td className="border border-slate-500 p-0.5">{f.bcva[k]}</td></tr>)}</tbody></table></div>
            <div className="space-y-0.5"><b>2. INTRAOCULAR PRESSURE (IOP)</b><div>• OD: <b>{f.iop.od}</b> mmHg &nbsp; • OS: <b>{f.iop.os}</b> mmHg</div><b>3. SLIT LAMP EXAMINATION (ANTERIOR SEGMENT)</b><div>• OD: <b>{f.slit.od}</b></div><div>• OS: <b>{f.slit.os}</b></div></div></div>
          <div className="mt-1"><b>4. FUNDUS EXAMINATION</b><div>• OD: <b>{f.fundus.od}</b></div><div>• OS: <b>{f.fundus.os}</b></div></div></div>
        <div className="grid grid-cols-[1fr_1.2fr_0.8fr] gap-2"><div className="min-h-[40px] rounded border border-slate-600 p-1.5"><b>RELEVANT INVESTIGATIONS</b><div>{f.investigations}</div></div><div className="rounded border border-slate-600 p-1.5"><b>PROCEDURE PERFORMED</b><div className="whitespace-pre-line">{f.procedure}</div></div>
          <div className="rounded border border-slate-600 p-1.5"><b>ANAESTHESIA</b><div className="mt-0.5 grid grid-cols-2 gap-x-2">{ANA.map(([k, l]) => <span key={k}><Cb on={f.anaesthesia[k]} />{l}</span>)}</div></div></div>
        <div className="min-h-[34px] rounded border border-slate-600 p-1.5"><b>INTRAOPERATIVE FINDINGS / COMPLICATIONS</b><div className="whitespace-pre-line">{f.intraop}</div></div>
        <div className="grid grid-cols-[1fr_1.7fr] gap-2"><div className="rounded border border-slate-600 p-1.5"><b>CONDITION AT DISCHARGE</b><div className="mt-0.5">• General condition: {f.status || 'Stable'}</div><div>• Vision at discharge: OD: <b>{f.vision.od}</b> &nbsp; OS: <b>{f.vision.os}</b></div>{f.quiet && <div>• Eye quiet / Dressing done / Eye shield applied</div>}{f.noComp && <div>• No immediate postoperative complications</div>}</div>
          <div className="rounded border border-slate-600 p-1.5"><b>DISCHARGE MEDICATIONS</b><table className="mt-0.5 w-full border-collapse text-center"><thead><tr>{['Medication', 'Eye', 'Dose', 'Frequency', 'Duration'].map(h => <th key={h} className="border border-slate-500 p-0.5">{h}</th>)}</tr></thead>
            <tbody>{medRows.map((m, i) => <tr key={i}>{['n', 'eye', 'dose', 'freq', 'days'].map(k => <td key={k} className={`h-[15px] border border-slate-500 p-0.5 ${k === 'n' ? 'text-left' : ''}`}>{m[k] || ''}</td>)}</tr>)}</tbody></table></div></div>
        <div className="grid grid-cols-[1fr_1fr] gap-2"><div className="rounded border border-slate-600 p-1.5"><b>FOLLOW-UP</b><div>First review on: <b>{f.followup}</b></div><div>Subsequent review: <b>{f.followup2}</b></div></div>
          <div className="space-y-1"><div className="rounded border border-slate-600 p-1.5"><b>CONDITION AT DISCHARGE</b><div className="mt-0.5 flex gap-4">{['Stable', 'Improved', 'Satisfactory'].map(k => <span key={k}><Cb on={f.status === k} />{k}</span>)}</div></div><div className="min-h-[30px] rounded border border-slate-600 p-1.5"><b>CONSULTANT'S REMARKS</b><div className="whitespace-pre-line">{f.remarks}</div></div></div></div>
        <div className="flex items-end justify-between pt-8 text-[10px] font-bold"><span className="border-t border-slate-700 px-6 pt-0.5">CONSULTANT SIGNATURE</span><span className="text-center text-[9px] font-normal italic text-slate-500">Thank you for trusting us with your vision</span><span className="border-t border-slate-700 px-6 pt-0.5">PATIENT / ATTENDANT SIGNATURE</span></div>
      </div></div></div>}</div>
}