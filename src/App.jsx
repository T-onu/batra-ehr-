import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, CalendarClock, ListOrdered, Stethoscope, ScanEye, BedDouble, FileCheck2, ReceiptIndianRupee, Pill, Glasses, ShieldCheck, LogOut, Construction } from 'lucide-react'
import { supabase, configured } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Queue from './pages/Queue'
import Clinical from './pages/Clinical'
import Billing from './pages/Billing'
import Ipd from './pages/Ipd'
import Appointments from './pages/Appointments'
import { can } from './lib/roles'

const NAV=[['dashboard',LayoutDashboard,'Dashboard',Dashboard],['patients',Users,'Patients & OPD',Patients],
['appointments',CalendarClock,'Appointments',Appointments],['queue',ListOrdered,'OPD Queue',Queue],['clinical',Stethoscope,'Clinical Exam',Clinical],
['diagnostics',ScanEye,'Investigations'],['ipd',BedDouble,'Admissions',Ipd],['discharge',FileCheck2,'Discharge Card'],
['billing',ReceiptIndianRupee,'Billing',Billing],['pharmacy',Pill,'Pharmacy'],['optical',Glasses,'Optical'],['audit',ShieldCheck,'Audit']]

function Logo({size=40}){return <img src="/logo.png" width={size} height={size} className="rounded-full bg-white" alt="Batra Eye"/>}

function Login(){
  const [email,setEmail]=useState(''),[pw,setPw]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false)
  const go=async e=>{e.preventDefault();setBusy(true);setErr('')
    const {error}=await supabase.auth.signInWithPassword({email,password:pw}); if(error)setErr(error.message); setBusy(false)}
  return <div className="min-h-screen grid place-items-center bg-gradient-to-br from-navy via-navy-700 to-accent p-4">
    <form onSubmit={go} className="card w-full max-w-sm p-7 space-y-4">
      <div className="flex flex-col items-center text-center"><Logo size={84}/><h1 className="mt-3 text-xl font-extrabold text-navy">Batra Eye Hospital</h1>
        <p className="text-xs text-slate-500">Digital EHR · Mukerian</p></div>
      <div><label className="lbl">Email</label><input className="inp" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div>
      <div><label className="lbl">Password</label><input className="inp" type="password" required value={pw} onChange={e=>setPw(e.target.value)}/></div>
      {err&&<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <button className="btn w-full" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form></div>
}

function Setup(){return <div className="min-h-screen grid place-items-center p-6"><div className="card max-w-md p-7 text-sm">
  <Logo size={64}/><h1 className="mt-3 text-lg font-bold text-navy">Supabase connect karo</h1>
  <p className="mt-2 text-slate-600">Project root me <code>.env</code> banao (<code>.env.example</code> copy karke) aur <code>VITE_SUPABASE_URL</code> + <code>VITE_SUPABASE_ANON_KEY</code> bharo. Phir <code>supabase/schema.sql</code> SQL Editor me run karo.</p></div></div>}

export default function App(){
  const [session,setSession]=useState(undefined),[page,setPage]=useState('dashboard'),[profile,setProfile]=useState(null)
  useEffect(()=>{ if(!configured)return
    supabase.auth.getSession().then(({data})=>setSession(data.session))
    const {data:s}=supabase.auth.onAuthStateChange((_,x)=>setSession(x)); return()=>s.subscription.unsubscribe()},[])
  useEffect(()=>{ if(session) supabase.from('profiles').select('*').eq('id',session.user.id).maybeSingle().then(({data})=>setProfile(data)) },[session])
  if(!configured)return <Setup/>
  if(session===undefined)return null
  if(!session)return <Login/>
  const role=profile?.role||'Reception', NAVV=NAV.filter(n=>can(role,n[0]))
  const cur=NAVV.find(n=>n[0]===page)||NAVV[0], Page=cur[3]
  const Item=({n,mobile})=>{const [id,I,t]=n,on=page===id
    return mobile?<button onClick={()=>setPage(id)} className={`flex min-w-[68px] flex-col items-center gap-0.5 px-2 py-2 text-[10px] font-semibold ${on?'text-accent':'text-slate-400'}`}><I size={20}/>{t.split(' ')[0]}</button>
    :<button onClick={()=>setPage(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on?'bg-white/15 text-white':'text-blue-200/80 hover:bg-white/10 hover:text-white'}`}><I size={18}/>{t}</button>}
  return <div className="flex min-h-screen">
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy p-4 md:flex">
      <div className="flex items-center gap-3 px-1 pb-5"><Logo/><div><div className="text-sm font-extrabold leading-tight text-white">Batra Eye Hospital</div><div className="text-[10px] text-blue-200">Digital EHR</div></div></div>
      <nav className="flex-1 space-y-1 overflow-y-auto">{NAVV.map(n=><Item key={n[0]} n={n}/>)}</nav>
      <div className="border-t border-white/10 pt-3"><div className="px-1 pb-2 text-xs text-blue-200">{profile?.name||session.user.email}<br/><b className="text-white">{profile?.role||'Staff'}</b></div>
        <button onClick={()=>supabase.auth.signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-blue-200/80 hover:bg-white/10"><LogOut size={18}/>Sign out</button></div>
    </aside>
    <main className="min-w-0 flex-1 pb-24 md:pb-8">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur md:px-8">
        <div className="flex items-center gap-2 md:hidden"><Logo size={32}/></div>
        <h1 className="text-lg font-extrabold text-navy">{cur[2]}</h1>
        <button onClick={()=>supabase.auth.signOut()} className="text-slate-400 md:hidden"><LogOut size={20}/></button>
      </header>
      <div className="p-4 md:p-8">{Page?<Page user={session.user} profile={profile}/>:
        <div className="card grid place-items-center gap-2 p-14 text-center text-slate-500"><Construction/><b className="text-navy">{cur[2]}</b><span className="text-sm">Ye module agle step me banega.</span></div>}</div>
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">{NAVV.map(n=><Item key={n[0]} n={n} mobile/>)}</nav>
  </div>
}
