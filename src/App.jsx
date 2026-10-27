import { useEffect, useState } from 'react'
import { LayoutDashboard, Users, CalendarClock, ListOrdered, Stethoscope, ScanEye, FolderOpen, BedDouble, FileCheck2, ReceiptIndianRupee, Pill, Glasses, ShieldCheck, BarChart3, Wallet, UserCog, KeyRound, LogOut, Ellipsis } from 'lucide-react'
import { supabase, configured } from './lib/supabase'
import { can } from './lib/roles'
import Dashboard from './pages/Dashboard'
import Patients from './pages/Patients'
import Queue from './pages/Queue'
import Appointments from './pages/Appointments'
import Clinical from './pages/Clinical'
import Billing from './pages/Billing'
import Ipd from './pages/Ipd'
import Discharge from './pages/Discharge'
import Reports from './pages/Reports'
import StaffRoles from './pages/StaffRoles'
import Audit from './pages/Audit'
import Investigations from './pages/Investigations'
import Documents from './pages/Documents'
import Account from './pages/Account'
import { Pharmacy, Optical } from './pages/Inventory'
import PasswordForm from './components/PasswordForm'

const NAV = [['dashboard', LayoutDashboard, 'Dashboard', Dashboard, 'Main'], ['patients', Users, 'Patients & OPD', Patients, 'Main'], ['appointments', CalendarClock, 'Appointments', Appointments, 'Main'], ['queue', ListOrdered, 'OPD Queue', Queue, 'Main'],
['clinical', Stethoscope, 'Clinical Exam', Clinical, 'Clinical'], ['diagnostics', ScanEye, 'OPD Investigation / Procedure', Investigations, 'Clinical'], ['ipd', BedDouble, 'Admissions', Ipd, 'Clinical'], ['discharge', FileCheck2, 'Discharge Card', Discharge, 'Clinical'], ['documents', FolderOpen, 'Documents', Documents, 'Clinical'],
['billing', ReceiptIndianRupee, 'IPD Final Bill', Billing, 'Billing & Stock'], ['receipts', Wallet, 'Money Receipt', Account, 'Billing & Stock'], ['pharmacy', Pill, 'Pharmacy', Pharmacy, 'Billing & Stock'], ['optical', Glasses, 'Optical', Optical, 'Billing & Stock'], ['reports', BarChart3, 'Reports', Reports, 'Billing & Stock'],
['users', UserCog, 'Staff & Roles', StaffRoles, 'Admin'], ['audit', ShieldCheck, 'Audit Log', Audit, 'Admin']]

const Logo = ({ size = 40 }) => <img src="/logo.png" width={size} height={size} className="shrink-0 rounded-full bg-white" alt="Batra Eye" />
function Login() {
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const go = async e => { e.preventDefault(); setBusy(true); setErr(''); const { error } = await supabase.auth.signInWithPassword({ email, password: pw }); if (error) setErr(error.message); setBusy(false) }
  return <div className="grid min-h-[100dvh] place-items-center bg-gradient-to-br from-navy via-navy-700 to-accent p-4">
    <form onSubmit={go} className="card w-full max-w-sm space-y-4 p-6 sm:p-8">
      <div className="flex flex-col items-center text-center"><Logo size={84} /><h1 className="mt-3 text-xl font-extrabold text-navy">Batra Eye Hospital</h1><p className="text-xs text-slate-500">Digital EHR · Mukerian</p></div>
      <div><label className="lbl">Email</label><input className="inp" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></div>
      <div><label className="lbl">Password</label><input className="inp" type="password" autoComplete="current-password" required value={pw} onChange={e => setPw(e.target.value)} /></div>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
      <button className="btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></div>
}
const Notice = ({ title, children }) => <div className="grid min-h-[100dvh] place-items-center p-6"><div className="card max-w-sm space-y-3 p-7 text-center text-sm"><div className="flex justify-center"><Logo size={56} /></div><b className="block text-navy">{title}</b>{children}</div></div>

export default function App() {
  const [session, setSession] = useState(undefined), [page, setPage] = useState('dashboard'), [profile, setProfile] = useState(null), [pLoaded, setPLoaded] = useState(false), [recovery, setRecovery] = useState(false), [pwOpen, setPwOpen] = useState(false), [more, setMore] = useState(false)
  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: s } = supabase.auth.onAuthStateChange((ev, x) => { if (ev === 'PASSWORD_RECOVERY') setRecovery(true); setSession(x) }); return () => s.subscription.unsubscribe()
  }, [])
  // Automatic sign-out after 30 minutes without any activity (shared reception computers)
  useEffect(() => {
    if (!session) return; const IDLE = 30 * 60 * 1000; let last = Date.now(); const mark = () => { last = Date.now() }
    const ev = ['pointerdown', 'keydown', 'scroll', 'touchstart']; ev.forEach(e => window.addEventListener(e, mark, { passive: true }))
    const iv = setInterval(() => { if (Date.now() - last > IDLE) supabase.auth.signOut() }, 30000)
    return () => { clearInterval(iv); ev.forEach(e => window.removeEventListener(e, mark)) }
  }, [!!session])
  useEffect(() => { setPLoaded(false); if (session) supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => { setProfile(data); setPLoaded(true) }) }, [session])
  if (!configured) return <Notice title="Connect Supabase"><p className="text-slate-600">Create a <code>.env</code> file in the project root (copy <code>.env.example</code>) and fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. Then run <code>supabase/schema.sql</code> in the Supabase SQL Editor.</p></Notice>
  if (session === undefined) return null
  if (!session) return <Login />
  if (recovery) return <div className="grid min-h-[100dvh] place-items-center p-4"><div className="card w-full max-w-sm p-6"><PasswordForm onDone={() => setRecovery(false)} /></div></div>
  if (!pLoaded) return null
  if (!profile || profile.active === false) return <Notice title={profile ? 'Your account is disabled' : 'Your staff profile was not found'}><p className="text-slate-500">Please contact the hospital administrator.</p><button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button></Notice>
  const NAVV = NAV.filter(n => can(profile.role, n[0])), cur = NAVV.find(n => n[0] === page) || NAVV[0], Page = cur[3], groups = [...new Set(NAVV.map(n => n[4]))]
  const primary = NAVV.slice(0, 4), rest = NAVV.slice(4), go = id => { setPage(id); setMore(false); window.scrollTo(0, 0) }
  const date = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }), first = (profile.name || '').includes('@') ? profile.email : profile.name
  const Side = ({ n }) => { const [id, I, t] = n, on = page === id || cur === n; return <button onClick={() => go(id)} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${on ? 'bg-white/15 text-white' : 'text-blue-200/80 hover:bg-white/10 hover:text-white'}`}><I size={16} />{t}</button> }
  const Tab = ({ n }) => { const [id, I, t] = n, on = cur[0] === id; return <button onClick={() => go(id)} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${on ? 'text-accent' : 'text-slate-400'}`}><I size={20} /><span className="max-w-full truncate px-1">{t.split(' ')[0]}</span></button> }
  return <div className="flex min-h-[100dvh]">
    <aside className="sticky top-0 hidden h-[100dvh] w-60 shrink-0 flex-col bg-navy p-3 md:flex">
      <div className="flex items-center gap-2.5 px-2 pb-4 pt-1"><Logo size={36} /><div className="min-w-0"><div className="truncate text-[13px] font-extrabold leading-tight text-white">Batra Eye Hospital</div><div className="text-[10px] text-blue-200">Digital EHR</div></div></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto pr-1">{groups.map(g => <div key={g}><div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-blue-300/50">{g}</div>{NAVV.filter(n => n[4] === g).map(n => <Side key={n[0]} n={n} />)}</div>)}</nav>
      <div className="border-t border-white/10 pt-3"><div className="flex items-center gap-2.5 px-2 pb-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold text-white">{(first || '?')[0].toUpperCase()}</div><div className="min-w-0 text-[11px] leading-tight text-blue-200"><div className="truncate">{first}</div><b className="text-white">{profile.role}</b></div></div>
        <button onClick={() => setPwOpen(true)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-blue-200/80 hover:bg-white/10"><KeyRound size={16} />Change password</button>
        <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-blue-200/80 hover:bg-white/10"><LogOut size={16} />Sign out</button></div>
    </aside>
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white/85 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5"><span className="md:hidden"><Logo size={30} /></span><h1 className="truncate text-base font-extrabold text-navy sm:text-lg">{cur[2]}</h1></div>
        <span className="hidden shrink-0 text-xs font-medium text-slate-400 sm:block">{date}</span></header>
      <div className="mx-auto w-full max-w-7xl p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 md:pb-8 lg:p-8"><Page user={session.user} profile={profile} /></div>
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">{primary.map(n => <Tab key={n[0]} n={n} />)}
      {rest.length > 0 && <button onClick={() => setMore(true)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${rest.includes(cur) ? 'text-accent' : 'text-slate-400'}`}><Ellipsis size={20} />More</button>}</nav>
    {more && <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMore(false)}><div className="absolute inset-0 bg-slate-900/40" />
      <div onClick={e => e.stopPropagation()} className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"><div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
        <div className="grid grid-cols-3 gap-2">{rest.map(n => { const [id, I, t] = n; return <button key={id} onClick={() => go(id)} className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-[11px] font-semibold ${cur === n ? 'bg-navy-50 text-navy' : 'bg-slate-50 text-slate-600'}`}><I size={22} />{t}</button> })}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs"><button onClick={() => { setMore(false); setPwOpen(true) }} className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-3 font-semibold text-slate-600"><KeyRound size={16} />Change password</button>
          <button onClick={() => supabase.auth.signOut()} className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-3 font-semibold text-slate-600"><LogOut size={16} />Sign out</button></div>
        <p className="mt-3 text-center text-[11px] text-slate-400">{first} · {profile.role}</p></div></div>}
    {pwOpen && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"><div className="card w-full max-w-sm p-6"><PasswordForm onDone={() => setPwOpen(false)} onCancel={() => setPwOpen(false)} /></div></div>}
  </div>
}