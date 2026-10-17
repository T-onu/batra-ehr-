import { useEffect, useState } from 'react'
import { Mail, UserCheck, UserX, Info } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ROLES } from '../lib/roles'
export default function StaffRoles({profile}){
  const isSuper=profile?.role==='Super Admin',[rows,setRows]=useState([]),[msg,setMsg]=useState('')
  const load=async()=>{const {data}=await supabase.from('profiles').select('*').order('created_at');setRows(data||[])}
  useEffect(()=>{load()},[])
  const patch=async(id,o)=>{setMsg('');const {error}=await supabase.from('profiles').update(o).eq('id',id);if(error)setMsg(error.message);else load()}
  const rename=r=>{const n=prompt('Name:',r.name||'');if(n&&n.trim())patch(r.id,{name:n.trim()})}
  const reset=async r=>{if(!r.email)return;const {error}=await supabase.auth.resetPasswordForEmail(r.email,{redirectTo:window.location.origin});setMsg(error?error.message:`Reset link sent to ${r.email} ✓`)}
  return <div className="space-y-4">
    <div className="card flex gap-3 bg-blue-50/60 p-4 text-xs text-slate-600"><Info size={16} className="mt-0.5 shrink-0 text-accent"/><div><b className="text-navy">How to add new staff:</b> In Supabase go to Authentication → Users → Add user (enter an email and password and tick <b>Auto Confirm</b>). The user appears here automatically with the Reception role — then set the correct role below. A disabled user sees nothing after signing in, and the database also refuses to give them any data.</div></div>
    {msg&&<p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{msg}</p>}
    <div className="card divide-y divide-slate-100">{rows.map(r=>{const me=r.id===profile?.id,locked=me||(r.role==='Super Admin'&&!isSuper)
      return <div key={r.id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm ${r.active?'':'bg-slate-50 opacity-70'}`}>
        <button className="min-w-0 flex-1 text-left" onClick={()=>!locked&&rename(r)}><b>{r.name||'—'}</b>{me&&<span className="ml-2 rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-bold text-navy">YOU</span>}<div className="truncate text-xs text-slate-400">{r.email}</div></button>
        <select className="inp !w-40 !py-1.5" disabled={locked} value={r.role} onChange={e=>patch(r.id,{role:e.target.value})}>{ROLES.filter(x=>isSuper||x!=='Super Admin').map(x=><option key={x}>{x}</option>)}{!isSuper&&r.role==='Super Admin'&&<option>Super Admin</option>}</select>
        <button disabled={locked} onClick={()=>patch(r.id,{active:!r.active})} className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${r.active?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-600'}`}>{r.active?<><UserCheck size={14}/>Active</>:<><UserX size={14}/>Disabled</>}</button>
        <button disabled={locked&&!me} onClick={()=>reset(r)} className="rounded-xl border border-slate-200 p-2 text-slate-500 disabled:opacity-40" title="Password reset email"><Mail size={14}/></button></div>})}</div></div>
}
