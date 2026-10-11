import { useEffect, useState } from 'react'
import { supabase, today } from '../lib/supabase'
const TONE={Waiting:'bg-amber-50 text-amber-700','In Exam':'bg-blue-50 text-accent',Done:'bg-emerald-50 text-emerald-700',Cancelled:'bg-slate-100 text-slate-400'}
export default function Queue(){
  const [rows,setRows]=useState([])
  const load=async()=>{const {data}=await supabase.from('visits').select('*, patients(name,age,sex,uhid)').eq('visit_date',today()).eq('kind','OPD').order('token');setRows(data||[])}
  useEffect(()=>{load();const ch=supabase.channel('queue').on('postgres_changes',{event:'*',schema:'public',table:'visits'},load).subscribe();return()=>supabase.removeChannel(ch)},[])
  const mv=(id,status)=>supabase.from('visits').update({status}).eq('id',id)
  const cols=['Waiting','In Exam','Done']
  return <div className="space-y-4"><p className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>Live — sabhi PCs/phones par turant update</p>
    <div className="grid gap-4 md:grid-cols-3">{cols.map(c=><div key={c} className="card p-3"><div className="mb-3 flex items-center justify-between px-2"><b className="text-sm text-navy">{c}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONE[c]}`}>{rows.filter(r=>r.status===c).length}</span></div>
      <div className="space-y-2">{rows.filter(r=>r.status===c).map(r=><div key={r.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-sm font-extrabold text-white">{r.token}</div>
          <div className="min-w-0"><div className="truncate text-sm font-semibold">{r.patients?.name}</div><div className="text-[11px] text-slate-400">{r.patients?.uhid} · {r.consultant||'—'}</div></div></div>
        <div className="mt-2 flex gap-2">
          {c==='Waiting'&&<button className="btn !py-1.5 !text-xs flex-1" onClick={()=>mv(r.id,'In Exam')}>Call in</button>}
          {c==='In Exam'&&<button className="btn !py-1.5 !text-xs flex-1" onClick={()=>mv(r.id,'Done')}>Mark done</button>}
          {c!=='Done'&&<button className="rounded-xl border border-slate-200 px-3 text-xs text-slate-500" onClick={()=>mv(r.id,'Cancelled')}>Cancel</button>}</div></div>)}
        {rows.filter(r=>r.status===c).length===0&&<p className="py-6 text-center text-xs text-slate-300">Khali</p>}</div></div>)}</div></div>
}
