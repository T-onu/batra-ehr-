import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase, inr, today } from '../lib/supabase'
const all=async mk=>{let out=[],i=0;for(;;){const {data,error}=await mk().range(i*1000,i*1000+999);if(error)throw error;out=out.concat(data||[]);if((data||[]).length<1000)return out;i++}}
const ld=x=>new Date(x).toLocaleDateString('en-CA')
export default function Reports(){
  const m=today().slice(0,8)+'01',[from,setFrom]=useState(m),[to,setTo]=useState(today()),[r,setR]=useState(null),[err,setErr]=useState('')
  const load=async()=>{setErr('');setR(null);try{const s=new Date(from+'T00:00:00').toISOString(),e=new Date(to+'T23:59:59.999').toISOString()
    const [pay,bills]=await Promise.all([all(()=>supabase.from('payments').select('amount,mode,created_at,bills(status)').gte('created_at',s).lte('created_at',e).order('created_at')),
      all(()=>supabase.from('bills').select('total,paid,discount,kind,status,bill_date').gte('bill_date',from).lte('bill_date',to).order('bill_date'))])
    const cnt=async(t,col,fn)=>(await fn(supabase.from(t).select('*',{count:'exact',head:true}))).count??0
    const [pts,opd,adm]=await Promise.all([cnt('patients','',q=>q.gte('created_at',s).lte('created_at',e)),cnt('visits','',q=>q.eq('kind','OPD').gte('visit_date',from).lte('visit_date',to)),cnt('admissions','',q=>q.in('status',['Admitted','Discharged']).gte('created_at',s).lte('created_at',e))])
    const P=pay.filter(x=>x.bills?.status!=='Cancelled'),B=bills.filter(x=>x.status!=='Cancelled'),sum=(a,k)=>a.reduce((t,x)=>t+Number(x[k]),0)
    const mode={},kind={},day={};P.forEach(x=>{mode[x.mode]=(mode[x.mode]||0)+Number(x.amount);const d=ld(x.created_at);(day[d]=day[d]||{d,col:0,billed:0,n:0}).col+=Number(x.amount)})
    B.forEach(x=>{kind[x.kind]=(kind[x.kind]||0)+Number(x.total);(day[x.bill_date]=day[x.bill_date]||{d:x.bill_date,col:0,billed:0,n:0});day[x.bill_date].billed+=Number(x.total);day[x.bill_date].n++})
    setR({collected:sum(P,'amount'),billed:sum(B,'total'),discount:sum(B,'discount'),due:sum(B,'total')-sum(B,'paid'),mode,kind,days:Object.values(day).sort((a,b)=>a.d.localeCompare(b.d)),pts,opd,adm,cancelled:bills.length-B.length})}catch(x){setErr(x.message)}}
  useEffect(()=>{load()},[from,to])
  const csv=()=>{const rows=[['Date','Bills','Billed','Collected'],...r.days.map(x=>[x.d,x.n,x.billed,x.col]),[],['Total','',r.billed,r.collected]]
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(x=>x.join(',')).join('\n')],{type:'text/csv'}));a.download=`report_${from}_to_${to}.csv`;a.click()}
  const S=({l,v,c})=><div className="card p-5"><div className={`text-2xl font-extrabold ${c||'text-navy'}`}>{v}</div><div className="text-xs font-medium text-slate-500">{l}</div></div>
  const Brk=({t,o})=><div className="card p-5"><h3 className="mb-2 font-extrabold text-navy">{t}</h3>{Object.keys(o).length===0?<p className="text-xs text-slate-400">No data.</p>:Object.entries(o).map(([k,v])=><div key={k} className="flex justify-between border-b border-slate-100 py-1.5 text-sm last:border-0"><span>{k}</span><b>{inr(v)}</b></div>)}</div>
  return <div className="space-y-4"><div className="flex flex-wrap items-end gap-3"><div><label className="lbl">From</label><input type="date" className="inp" value={from} onChange={e=>setFrom(e.target.value)}/></div><div><label className="lbl">To</label><input type="date" className="inp" value={to} onChange={e=>setTo(e.target.value)}/></div>
    {r&&<button className="btn ml-auto" onClick={csv}><Download size={16}/>CSV</button>}</div>
    {err&&<p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{err}</p>}{!r&&!err&&<p className="p-10 text-center text-sm text-slate-400">Loading…</p>}
    {r&&<><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="Collected (cash-in)" v={inr(r.collected)} c="text-emerald-600"/><S l="Billed (net)" v={inr(r.billed)}/><S l="Outstanding dues" v={inr(r.due)} c="text-red-600"/><S l="Discount given" v={inr(r.discount)}/></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><S l="New patients" v={r.pts}/><S l="OPD visits" v={r.opd}/><S l="Admissions" v={r.adm}/><S l="Cancelled bills" v={r.cancelled}/></div>
      <div className="grid gap-4 md:grid-cols-2"><Brk t="Collection by mode" o={r.mode}/><Brk t="Billing by type" o={r.kind}/></div>
      <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500"><th className="p-3">Date</th><th>Bills</th><th className="text-right">Billed</th><th className="p-3 text-right">Collected</th></tr></thead>
        <tbody>{r.days.map(x=><tr key={x.d} className="border-b border-slate-100"><td className="p-3 font-semibold">{x.d}</td><td>{x.n}</td><td className="text-right">{inr(x.billed)}</td><td className="p-3 text-right">{inr(x.col)}</td></tr>)}</tbody></table></div></>}</div>
}
