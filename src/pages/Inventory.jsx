import { useEffect, useState } from 'react'
import { Search, X, Trash2 } from 'lucide-react'
import { supabase, inr, today } from '../lib/supabase'
import Receipt from '../components/Receipt'
import ProcedurePick from '../components/ProcedurePick'
const AUTH=['Dr. Akhil Batra','Dr. Sunanda','Other'],GLASS=['Single Vision','Bifocal','Progressive','Blue Cut','Anti-Glare','Photochromic','Polycarbonate','High Index']
const dleft=d=>d?Math.ceil((new Date(d)-new Date(today()))/864e5):null
const call=async(fn,a)=>{const {data,error}=await supabase.rpc(fn,a);if(error)throw error;return data}
const fetchAll=async mk=>{let o=[],i=0;for(;;){const {data,error}=await mk().range(i*1000,i*1000+999);if(error)throw error;o=o.concat(data||[]);if((data||[]).length<1000)return o;i++}}
function PatientPick({pt,setPt}){const [q,setQ]=useState(''),[res,setRes]=useState([])
  useEffect(()=>{if(!q.trim()){setRes([]);return};const t=setTimeout(async()=>{const {data}=await supabase.from('patients').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%,uhid.ilike.%${q}%`).limit(6);setRes(data||[])},250);return()=>clearTimeout(t)},[q])
  if(pt)return <div className="flex items-center justify-between rounded-xl bg-navy-50 p-3 text-sm"><div><b>{pt.name}</b><div className="text-xs text-slate-500">{pt.uhid} · {pt.phone}</div></div><button onClick={()=>setPt(null)}><X size={16}/></button></div>
  return <div><div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder="Patient: name / phone / UHID" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {res.map(p=><button key={p.id} onClick={()=>setPt(p)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><b>{p.name}</b> <span className="text-xs text-slate-400">{p.uhid} · {p.phone}</span></button>)}</div>}
const Err=({e})=>e?<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{e}</p>:null

function Inventory({module,profile}){
  const ph=module==='pharmacy',ok=['Admin','Super Admin'].includes(profile?.role),isAdm=['Admin','Super Admin'].includes(profile?.role),canSell=ok||(module==='optical'&&profile?.role==='Reception')
  const [tab,setTab]=useState('stock'),[items,setItems]=useState([]),[q,setQ]=useState(''),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[rcpt,setRcpt]=useState(null)
  const load=async()=>{try{setItems(await fetchAll(()=>supabase.from('stock_items').select('*').eq('module',module).order('product')))}catch(e){setErr(e.message)}}
  const [oc,setOc]=useState([])
  useEffect(()=>{load();if(module==='optical')supabase.from('catalog_items').select('id,name,rate').eq('kind','optical_item').eq('active',true).order('name').then(({data})=>setOc(data||[]))},[module])
  const by=Object.fromEntries(items.map(i=>[i.id,i])),has=(i,s)=>[i.product,i.generic,i.salt,i.batch_no,i.vendor].some(v=>(v||'').toLowerCase().includes(s.toLowerCase()))
  // ---- sell
  const [pt,setPt]=useState(null),[cart,setCart]=useState([]),[sq,setSq]=useState(''),[disc,setDisc]=useState(''),[au,setAu]=useState(AUTH[0]),[auO,setAuO]=useState(''),[paid,setPaid]=useState(''),[mode,setMode]=useState('Cash'),[dl,setDl]=useState(''),[ref,setRef]=useState(''),[cu,setCu]=useState({name:'',qty:'1',rate:''})
  const sellable=items.filter(i=>i.qty_on_hand>0&&!(i.expiry&&dleft(i.expiry)<0)),hits=sq.trim()?sellable.filter(i=>has(i,sq)).slice(0,8):[]
  const unit=c=>c.custom?(+c.rate||0):(by[c.id]?.mrp||0),sub=cart.reduce((a,c)=>a+(+c.qty||0)*unit(c),0),tot=Math.max(0,sub-(+disc||0))
  const addCustom=()=>{setErr('');if(!cu.name.trim())return setErr('Enter the product / frame name');if(!(+cu.qty>0))return setErr('Enter a valid quantity');if(cu.rate===''||+cu.rate<0)return setErr('Enter the price');setCart([...cart,{id:'c'+Date.now(),custom:true,name:cu.name.trim(),qty:+cu.qty,rate:+cu.rate}]);setCu({name:'',qty:'1',rate:''})}
  const sell=async()=>{setErr('');if(+paid>0&&mode!=='Cash'&&!ref.trim()){return setErr(mode==='UPI'?'Enter the UPI transaction / UTR number':'Enter the card slip number or last 4 digits')};setBusy(true);try{const id=await call('stock_sale',{p_module:module,p_patient:pt?.id||null,p_items:cart.map(c=>c.custom?{custom:true,name:c.name,qty:+c.qty,rate:c.rate}:{stock_id:c.id,qty:+c.qty}),p_discount:+disc||0,p_authority:au==='Other'?auO:au,p_paid:+paid||0,p_mode:mode,p_delivery:dl||null,p_ref:ref})
    const {data:b}=await supabase.from('bills').select('*, patients(name,uhid)').eq('id',id).single();setRcpt(b);setPt(null);setCart([]);setDisc('');setPaid('');setDl('');setRef('');load()}catch(e){setErr(e.message)}setBusy(false)}
  // ---- purchase
  const P0={product:'',generic:'',salt:'',vendor:'',vphone:'',batch:'',expiry:'',pp:'',mrp:'',qty:'',date:today(),fs:'M',gt:'Single Vision'},[pf,setPf]=useState(P0),[pm,setPm]=useState('')
  const buy=async()=>{setErr('');setPm('');setBusy(true);try{await call('stock_purchase',{p_module:module,p_product:pf.product,p_generic:pf.generic,p_salt:pf.salt,p_vendor:pf.vendor,p_vphone:pf.vphone,p_batch:pf.batch,p_expiry:pf.expiry||null,p_pp:+pf.pp||0,p_mrp:pf.mrp===''?null:+pf.mrp,p_qty:+pf.qty,p_date:pf.date,p_fs:ph?null:pf.fs,p_gt:ph?null:pf.gt});setPm('Stock added ✓');setPf(P0);load()}catch(e){setErr(e.message)}setBusy(false)}
  const sp=k=>e=>setPf({...pf,[k]:e.target.value}),PI=(k,l,t='text')=><div><label className="lbl">{l}</label><input className="inp" type={t} value={pf[k]} onChange={sp(k)}/></div>
  // ---- returns
  const [rp,setRp]=useState(null),[bills,setBills]=useState([]),[bs,setBs]=useState(null),[cn,setCn]=useState([]),[rq,setRq]=useState({}),[rs,setRs]=useState(''),[rm,setRm]=useState('')
  useEffect(()=>{setBs(null);if(!rp){setBills([]);return};supabase.from('bills').select('*').eq('patient_id',rp.id).eq('kind',ph?'Pharmacy':'Optical').neq('status','Cancelled').order('created_at',{ascending:false}).then(({data})=>setBills(data||[]))},[rp])
  const pick=async b=>{setBs(b);setRq({});const {data}=await supabase.from('credit_notes').select('stock_id,qty').eq('bill_id',b.id);setCn(data||[])}
  const done=sid=>cn.filter(c=>c.stock_id===sid).reduce((a,c)=>a+c.qty,0)
  const ret=async it=>{setErr('');setRm('');try{const r=await call('stock_return_patient',{p_bill:bs.id,p_stock:it.stock_id,p_qty:+rq[it.stock_id],p_reason:rs});setRm(`Credit note ${r.cn_no} · amount ${inr(r.amount)} · refund ${inr(r.refund)}`)
    const {data:nb}=await supabase.from('bills').select('*').eq('id',bs.id).single();pick(nb);load()}catch(e){setErr(e.message)}}
  // ---- stock row actions
  const rm_=async(i,kind)=>{const n=+prompt(`${i.product}: how many units? (in stock: ${i.qty_on_hand})`);if(!n)return;const note=prompt(kind==='VENDOR_RETURN'?'Vendor name / credit note reference:':'Reason (damage/expired/…):');if(!note)return
    try{await call('stock_remove',{p_stock:i.id,p_qty:n,p_kind:kind,p_note:note});load()}catch(e){alert(e.message)}}
  const fixMrp=async i=>{const v=prompt('New MRP:',i.mrp);if(v===null||v===''||isNaN(+v))return;const {error}=await supabase.from('stock_items').update({mrp:+v}).eq('id',i.id);if(error)alert(error.message);else load()}
  const live=items.filter(i=>i.qty_on_hand>0),soon=live.filter(i=>i.expiry&&dleft(i.expiry)<=60),shown=items.filter(i=>!q.trim()||has(i,q))
  return <div className="space-y-4"><div className="flex flex-wrap gap-2">{[['stock','Stock'],['sell','Sell'],['purchase','Purchase'],['returns','Patient return']].filter(([k])=>k!=='purchase'||ok).map(([k,l])=><button key={k} onClick={()=>{setTab(k);setErr('')}} className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab===k?'bg-navy text-white':'bg-white text-slate-500'}`}>{l}</button>)}</div>
    {!canSell&&<p className="rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">Your role has view-only access.</p>}
    {tab==='stock'&&<><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Items in stock',live.length],['Total units',live.reduce((a,i)=>a+i.qty_on_hand,0)],['Value @ cost',inr(live.reduce((a,i)=>a+i.qty_on_hand*i.purchase_price,0))],['Value @ MRP',inr(live.reduce((a,i)=>a+i.qty_on_hand*i.mrp,0))]].map(([l,v])=><div key={l} className="card p-4"><div className="text-xl font-extrabold text-navy">{v}</div><div className="text-xs text-slate-500">{l}</div></div>)}</div>
      {ph&&soon.length>0&&<p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">⚠ {soon.filter(i=>dleft(i.expiry)<0).length} expired · {soon.filter(i=>dleft(i.expiry)>=0).length} batch(es) expiring within 60 days</p>}
      <div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder="Product / generic / salt / batch / vendor" value={q} onChange={e=>setQ(e.target.value)}/></div><Err e={err}/>
      <div className="card divide-y divide-slate-100">{shown.length===0&&<p className="p-10 text-center text-sm text-slate-400">No stock found.</p>}
        {shown.map(i=>{const d=dleft(i.expiry);return <div key={i.id} className={`flex flex-wrap items-center gap-3 px-5 py-3 text-sm ${i.qty_on_hand===0?'opacity-50':''}`}>
          <div className="min-w-0 flex-1"><b>{i.product}</b><div className="text-xs text-slate-400">{[i.generic,i.salt,i.batch_no&&'Batch '+i.batch_no,i.frame_size&&'Size '+i.frame_size,i.glass_type,i.vendor].filter(Boolean).join(' · ')}</div></div>
          {i.expiry&&<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d<0?'bg-red-50 text-red-600':d<=60?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-500'}`}>{d<0?'EXPIRED':'Exp'} {i.expiry}</span>}
          <span className="w-16 text-right text-xs text-slate-500">MRP {inr(i.mrp)}</span><b className="w-14 text-right">{i.qty_on_hand}</b>
          {ok&&i.qty_on_hand>0&&<><button className="text-xs text-slate-500 underline" onClick={()=>rm_(i,'VENDOR_RETURN')}>Vendor ret.</button><button className="text-xs text-red-500 underline" onClick={()=>rm_(i,'WRITE_OFF')}>Write-off</button></>}
          {isAdm&&<button className="text-xs text-accent underline" onClick={()=>fixMrp(i)}>MRP</button>}</div>})}</div></>}
    {tab==='sell'&&<div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="space-y-4"><div className="card space-y-3 p-5"><label className="lbl">Patient *</label><PatientPick pt={pt} setPt={setPt}/></div>
      <div className="card space-y-3 p-5"><div className="relative"><Search size={16} className="absolute left-3.5 top-3 text-slate-400"/><input className="inp pl-10" placeholder={ph?'Drug / generic / salt search':'Product / frame search'} value={sq} onChange={e=>setSq(e.target.value)}/></div>
        {hits.map(i=><button key={i.id} onClick={()=>{if(!cart.find(c=>c.id===i.id))setCart([...cart,{id:i.id,qty:1}]);setSq('')}} className="flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><span><b>{i.product}</b> <span className="text-xs text-slate-400">{i.batch_no&&'['+i.batch_no+'] '}{i.expiry&&'exp '+i.expiry}</span></span><span className="text-xs text-slate-500">{inr(i.mrp)} · stock {i.qty_on_hand}</span></button>)}
        {cart.map(c=>{const i=by[c.id];return <div key={c.id} className="grid grid-cols-[1fr_64px_80px_24px] items-center gap-2 text-sm"><span className="truncate">{c.custom?c.name:i?.product} <span className="text-xs text-slate-400">{c.custom?`custom · ${inr(c.rate)}`:i?.batch_no}</span></span>
          <input className="inp !px-2 text-center" type="number" min="1" max={c.custom?undefined:i?.qty_on_hand} value={c.qty} onChange={e=>setCart(cart.map(x=>x.id===c.id?{...x,qty:e.target.value}:x))}/><b className="text-right">{inr((+c.qty||0)*unit(c))}</b><button onClick={()=>setCart(cart.filter(x=>x.id!==c.id))} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button></div>})}
        {!ph&&canSell&&<div className="space-y-2 rounded-xl border border-dashed border-slate-300 p-3"><div className="text-xs font-semibold text-slate-500">Add from the optical list or type a custom product / frame (price filled automatically when listed)</div>
          <div className="grid grid-cols-[1fr_56px_84px_auto] gap-2"><ProcedurePick items={oc} value={cu.name} onChange={v=>setCu({...cu,name:v})} onPick={c=>setCu({...cu,name:c.name,rate:c.rate==null?cu.rate:String(c.rate)})} placeholder="Choose or type a name"/><input className="inp !px-2 text-center" type="number" min="1" value={cu.qty} onChange={e=>setCu({...cu,qty:e.target.value})}/><input className="inp !px-2" type="number" placeholder="Price" value={cu.rate} onChange={e=>setCu({...cu,rate:e.target.value})}/><button className="btn !px-3" onClick={addCustom}>Add</button></div></div>}
        {cart.length===0&&<p className="text-xs text-slate-400">Search above to add an item.</p>}</div></div>
      <div className="card h-fit space-y-3 p-5"><div className="flex justify-between text-sm"><span>Subtotal</span><b>{inr(sub)}</b></div>
        <div><label className="lbl">Discount (₹)</label><input className="inp" type="number" value={disc} onChange={e=>setDisc(e.target.value)}/></div>
        {+disc>0&&<div><label className="lbl">Discount authority *</label><select className="inp" value={au} onChange={e=>setAu(e.target.value)}>{AUTH.map(a=><option key={a}>{a}</option>)}</select>{au==='Other'&&<input className="inp mt-2" placeholder="Full name" value={auO} onChange={e=>setAuO(e.target.value)}/>}</div>}
        {!ph&&<div><label className="lbl">Expected delivery</label><input type="date" className="inp" value={dl} onChange={e=>setDl(e.target.value)}/></div>}
        <div className="flex justify-between border-t pt-3 text-lg font-extrabold text-navy"><span>Total</span><span>{inr(tot)}</span></div>
        <div className="grid grid-cols-2 gap-2"><div><label className="lbl">Paid (₹)</label><input className="inp" type="number" value={paid} onChange={e=>setPaid(e.target.value)}/></div><div><label className="lbl">Mode</label><select className="inp" value={mode} onChange={e=>setMode(e.target.value)}><option>Cash</option><option>UPI</option><option>Card</option></select></div></div>
        {mode!=='Cash'&&+paid>0&&<div><label className="lbl">{mode==='UPI'?'UPI Txn / UTR number *':'Card slip no. or last 4 digits *'}</label><input className="inp" value={ref} onChange={e=>setRef(e.target.value)}/></div>}
        <Err e={err}/><button className="btn w-full" disabled={busy||!canSell} onClick={sell}>{busy?'Saving…':'Generate invoice'}</button></div></div>}
    {tab==='purchase'&&<div className="card max-w-2xl space-y-4 p-6"><div className="grid gap-3 sm:grid-cols-2"><div className="sm:col-span-2">{PI('product','Product name *')}</div>
      {ph?<>{PI('generic','Generic name')}{PI('salt','Salt name')}{PI('batch','Batch no. *')}{PI('expiry','Expiry date *','date')}</>:<><div><label className="lbl">Frame size</label><select className="inp" value={pf.fs} onChange={sp('fs')}><option>S</option><option>M</option><option>L</option></select></div><div><label className="lbl">Glass type</label><select className="inp" value={pf.gt} onChange={sp('gt')}>{GLASS.map(g=><option key={g}>{g}</option>)}</select></div></>}
      {PI('vendor','Vendor name')}{PI('vphone','Vendor phone')}{PI('pp','Purchase price (₹)','number')}{PI('mrp','MRP (₹) *','number')}{PI('qty','Quantity *','number')}{PI('date','Date of purchase','date')}</div>
      <Err e={err}/>{pm&&<p className="text-sm font-semibold text-emerald-600">{pm}</p>}<button className="btn w-full" disabled={busy||!ok} onClick={buy}>{busy?'Saving…':'Save purchase'}</button></div>}
    {tab==='returns'&&<div className="card max-w-2xl space-y-4 p-6"><PatientPick pt={rp} setPt={setRp}/>
      {rp&&!bs&&<div className="divide-y divide-slate-100">{bills.length===0&&<p className="py-4 text-sm text-slate-400">This patient has no {module} bills.</p>}{bills.map(b=><button key={b.id} onClick={()=>pick(b)} className="flex w-full justify-between py-2.5 text-left text-sm hover:bg-slate-50"><span><b>{b.bill_no}</b> <span className="text-xs text-slate-400">{b.bill_date}</span></span><span>{inr(b.total)}</span></button>)}</div>}
      {bs&&<><div className="flex justify-between text-sm"><b>{bs.bill_no}</b><button className="text-xs text-accent" onClick={()=>setBs(null)}>← bills</button></div>
        <div><label className="lbl">Return reason (required for the credit note) *</label><input className="inp" value={rs} onChange={e=>setRs(e.target.value)}/></div>
        {bs.items.filter(i=>i.stock_id).map(i=>{const left=i.q-done(i.stock_id);return <div key={i.stock_id} className="grid grid-cols-[1fr_70px_90px] items-center gap-2 text-sm"><span>{i.d} <span className="text-xs text-slate-400">sold {i.q} · returnable {left}</span></span>
          <input className="inp !px-2 text-center" type="number" min="1" max={left} disabled={left===0} value={rq[i.stock_id]||''} onChange={e=>setRq({...rq,[i.stock_id]:e.target.value})}/><button className="btn !py-2 !text-xs" disabled={left===0||!rq[i.stock_id]} onClick={()=>ret(i)}>Return</button></div>})}
        {rm&&<p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{rm}</p>}<Err e={err}/></>}</div>}
    {rcpt&&<Receipt b={rcpt} onClose={()=>setRcpt(null)}/>}</div>
}
export const Pharmacy=p=><Inventory module="pharmacy" {...p}/>
export const Optical=p=><Inventory module="optical" {...p}/>
