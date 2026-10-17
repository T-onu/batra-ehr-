import { useEffect, useState } from 'react'
import { supabase, today } from '../lib/supabase'
const TABLES=['all','patients','visits','appointments','exams','bills','payments','admissions','discharge_summaries','beds','profiles','stock_items','stock_moves','credit_notes','investigations','documents','catalog_items']
const ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toLocaleDateString('en-CA')}
const cut=v=>{const s=typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'—');return s.length>34?s.slice(0,34)+'…':s}
const label=c=>c.name||c.bill_no||c.adm_no||c.visit_no||c.uhid||c.procedure||c.bed_no||c.amount&&'₹'+c.amount||''
const summ=r=>r.action==='UPDATE'?Object.entries(r.changes||{}).filter(([k])=>k!=='updated_at').slice(0,3).map(([k,v])=>`${k}: ${cut(v.from)} → ${cut(v.to)}`).join(' · '):label(r.changes||{})
const TONE={INSERT:'bg-emerald-50 text-emerald-700',UPDATE:'bg-blue-50 text-accent',DELETE:'bg-red-50 text-red-600'}
export default function Audit(){
  const [t,setT]=useState('all'),[u,setU]=useState(''),[from,setFrom]=useState(ago(7)),[to,setTo]=useState(today()),[rows,setRows]=useState([]),[pg,setPg]=useState(0),[more,setMore]=useState(false),[open,setOpen]=useState(null),[err,setErr]=useState('')
  const fetchPg=async(p)=>{let q=supabase.from('audit_log').select('*').gte('at',new Date(from+'T00:00:00').toISOString()).lte('at',new Date(to+'T23:59:59.999').toISOString()).order('at',{ascending:false}).range(p*100,p*100+99)
    if(t!=='all')q=q.eq('table_name',t);if(u.trim())q=q.ilike('user_email',`%${u.trim()}%`);const {data,error}=await q;if(error)return setErr(error.message);setErr('')
    setRows(p?x=>[...x,...data]:data);setMore(data.length===100);setPg(p)}
  useEffect(()=>{const id=setTimeout(()=>fetchPg(0),250);return()=>clearTimeout(id)},[t,u,from,to])
  return <div className="space-y-4"><div className="flex flex-wrap items-end gap-3"><div><label className="lbl">Table</label><select className="inp" value={t} onChange={e=>setT(e.target.value)}>{TABLES.map(x=><option key={x}>{x}</option>)}</select></div>
    <div><label className="lbl">User email</label><input className="inp" value={u} onChange={e=>setU(e.target.value)} placeholder="search"/></div>
    <div><label className="lbl">From</label><input type="date" className="inp" value={from} onChange={e=>setFrom(e.target.value)}/></div><div><label className="lbl">To</label><input type="date" className="inp" value={to} onChange={e=>setTo(e.target.value)}/></div></div>
    {err&&<p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{err}</p>}
    <div className="card divide-y divide-slate-100">{rows.length===0&&<p className="p-10 text-center text-sm text-slate-400">No records match these filters.</p>}
      {rows.map(r=><div key={r.id} className="px-5 py-3 text-xs"><button className="flex w-full flex-wrap items-center gap-2 text-left" onClick={()=>setOpen(open===r.id?null:r.id)}>
        <span className="w-32 text-slate-400">{new Date(r.at).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'})}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[r.action]}`}>{r.action}</span>
        <b className="text-navy">{r.table_name}</b><span className="text-slate-500">{r.user_email||'system'}</span><span className="min-w-0 flex-1 truncate text-slate-600">{summ(r)}</span></button>
        {open===r.id&&<pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px]">{JSON.stringify(r.changes,null,2)}</pre>}</div>)}</div>
    {more&&<button className="btn mx-auto" onClick={()=>fetchPg(pg+1)}>Load more</button>}</div>
}
