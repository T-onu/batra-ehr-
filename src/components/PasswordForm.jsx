import { useState } from 'react'
import { supabase } from '../lib/supabase'
export default function PasswordForm({onDone,onCancel}){
  const [a,setA]=useState(''),[b,setB]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const go=async e=>{e.preventDefault();setErr('');if(a.length<8)return setErr('Kam se kam 8 characters');if(a!==b)return setErr('Dono password match nahi karte')
    setBusy(true);const {error}=await supabase.auth.updateUser({password:a});setBusy(false);if(error)return setErr(error.message);onDone()}
  return <form onSubmit={go} className="space-y-3"><h2 className="text-lg font-extrabold text-navy">Naya password</h2>
    <div><label className="lbl">New password</label><input className="inp" type="password" value={a} onChange={e=>setA(e.target.value)}/></div>
    <div><label className="lbl">Confirm</label><input className="inp" type="password" value={b} onChange={e=>setB(e.target.value)}/></div>
    {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
    <div className="flex gap-2"><button className="btn flex-1" disabled={busy}>{busy?'Saving…':'Update password'}</button>{onCancel&&<button type="button" className="px-3 text-sm text-slate-500" onClick={onCancel}>Cancel</button>}</div></form>
}
