// Imports the old Electron software's ehr-data.json into the Supabase database.
//   node import-old-data.mjs --file ../ehr-data.json                      -> DRY RUN (nothing is saved)
//   node import-old-data.mjs --file ../ehr-data.json --wipe-test-data     -> dry run including removal of test data
//   add --commit to really save.   DATABASE_URL = Supabase "Session pooler" connection string.
import fs from 'node:fs'
import crypto from 'node:crypto'
import readline from 'node:readline/promises'
import pg from 'pg'

const args=process.argv.slice(2),has=f=>args.includes(f),arg=f=>{const i=args.indexOf(f);return i>=0?args[i+1]:null}
const FILE=arg('--file')||'../ehr-data.json',COMMIT=has('--commit'),WIPE=has('--wipe-test-data'),URL=process.env.DATABASE_URL
if(!URL){console.error('Set DATABASE_URL first (see migration/README.md).');process.exit(1)}
const d=JSON.parse(fs.readFileSync(FILE,'utf8')),uuid=()=>crypto.randomUUID()
const warn=[],note=(k,m)=>warn.push([k,m])
const clean=s=>String(s??'').replace(/\s+/g,' ').trim(),nul=s=>{s=clean(s);return s?s:null}
const pad=(n,l=6)=>String(n).padStart(l,'0')
const ist=(date,time)=>{ // date 'YYYY-MM-DD', time '15:09' or '03:55 PM' (India time) -> ISO
  let h=12,m=0;const t=clean(time);const x=t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if(x){h=+x[1];m=+x[2];if(x[3]){const pm=x[3].toUpperCase()==='PM';if(pm&&h<12)h+=12;if(!pm&&h===12)h=0}}
  return `${date}T${pad(h,2)}:${pad(m,2)}:00+05:30`}
const tsOf=(...c)=>{for(const v of c)if(v&&!isNaN(Date.parse(v)))return new Date(v).toISOString();return null}
const mode=m=>/upi|online/i.test(m||'')?'UPI':/card/i.test(m||'')?'Card':'Cash'
const staff=s=>{s=clean(s);if(!s)return null;if(/^excel import/i.test(s))return 'Excel import (Aug 2026)';if(/software developer/i.test(s))return 'Super Admin';return s}
const doctor=s=>{s=clean(s);if(!s||/not recorded/i.test(s))return null;return s.replace(/^Dr\.?\s*/i,'Dr. ')}
const sumItems=its=>(its||[]).reduce((a,i)=>a+(+i.qty||0)*(+i.rate||0),0)

// ---------- patients ----------
const pat=new Map()
for(const x of d.patients){
  const num=parseInt(String(x.uhid).split('-').pop(),10);if(!num)throw Error('Bad UHID '+x.uhid)
  let name=clean(x.name),father=null,rel='S/O'
  const m=name.match(/^(.*?)\s*\b([SDWCH])\s*\/\s*O\b\.?\s*(.*)$/i)
  if(m&&clean(m[1])){name=clean(m[1]);father=nul(m[3]);rel=(m[2].toUpperCase()==='H'?'C':m[2].toUpperCase())+'/O'}
  if(nul(x.careOfName)){father=clean(x.careOfName);rel=/^[SDWC]\/O$/i.test(clean(x.careOfType))?clean(x.careOfType).toUpperCase():rel}
  let age=null;const a=String(x.age??'').trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]*)/i)
  if(a){const v=parseFloat(a[1]),u=(a[2]||x.ageUnit||'').toLowerCase();age=u.startsWith('month')?Math.floor(v/12):u.startsWith('day')?0:Math.floor(v)}
  else if(clean(x.age))note('age','Could not read age "'+x.age+'" for '+x.uhid)
  if(age!=null&&(age<0||age>120)){note('age','Unlikely age '+age+' for '+x.uhid);}
  const phone=nul(x.mobile)
  pat.set(x.uhid,{id:uuid(),uhid:pad(num),legacy_uhid:x.uhid,name,age,sex:['Male','Female','Other'].includes(x.gender)?x.gender:null,phone,address:nul(x.address),father_name:father,relation:rel,created_at:tsOf(x.createdAt)||ist(String(x.createdAt||'2026-08-01').slice(0,10),'')})}
if(new Set([...pat.values()].map(p=>p.uhid)).size!==pat.size)throw Error('Two patients map to the same new UHID')

// ---------- OPD visits (registrations) ----------
const regs=[...d.opdRegistrations].sort((a,b)=>(a.date+(a.registeredAt||a.createdAt||a.date)).localeCompare(b.date+(b.registeredAt||b.createdAt||b.date))||(+a.sourceSerialNo||0)-(+b.sourceSerialNo||0))
const visits=[],visitByOpd=new Map(),tok={}
regs.forEach((r,i)=>{const p=pat.get(r.uhid);if(!p){note('skip','OPD '+r.opdNo+' has unknown UHID '+r.uhid);return}
  tok[r.date]=(tok[r.date]||0)+1
  const v={id:uuid(),patient_id:p.id,kind:'OPD',visit_no:'OPD'+pad(visits.length+1),legacy_no:r.opdNo,visit_date:r.date,consultant:doctor(r.doctor),fee:+r.fee||0,discount:+r.discount||0,paid:+r.netAmount||0,mode:mode(r.paymentMode),status:'Done',token:tok[r.date],
    created_at:tsOf(r.registeredAt,r.createdAt,r.systemCreatedAt)||ist(r.date,r.time)};visits.push(v);visitByOpd.set(r.opdNo,{v,r})})

// ---------- invoices: remove the 12 copies stored under the wrong patient ----------
const regByReceipt=new Map(regs.map(r=>[r.receiptId,r])),seen=new Map(),invoices=[]
for(const x of d.patients)for(const i of x.invoices){const k=i.id
  if(seen.has(k)){const r=regByReceipt.get(k),prev=seen.get(k)
    if(r&&r.uhid===x.uhid){invoices[invoices.indexOf(prev)]={...i,_uhid:x.uhid};seen.set(k,invoices[invoices.indexOf(prev)])}
    note('duplicate','Invoice '+k+' was stored under two patients ('+prev._uhid+' and '+x.uhid+'); kept it under '+(r?r.uhid:prev._uhid));continue}
  const e={...i,_uhid:x.uhid};invoices.push(e);seen.set(k,e)}

// ---------- IPD admissions ----------
const adm=[],admByIpd=new Map()
const ipds=[];for(const x of d.patients)for(const o of x.otipd)ipds.push({x,o})
ipds.sort((a,b)=>(a.o.admissionDate+(a.o.admissionTime||'')).localeCompare(b.o.admissionDate+(b.o.admissionTime||'')))
ipds.forEach(({x,o})=>{const p=pat.get(x.uhid);const vis=visitByOpd.get(o.sourceOpdNo)
  const a={id:uuid(),adm_no:'IPD'+pad(adm.length+1),legacy_no:o.ipdNo,patient_id:p.id,visit_id:vis?vis.v.id:null,procedure:clean(o.procedure),side:['OD','OS','OU'].includes(o.side)?o.side:'OS',surgeon:doctor(o.surgeon)||nul(o.surgeon),bed_id:null,preop:nul(o.preop),category:nul(o.category)||'Cash',refer_no:nul(o.referNo),planned_date:null,advance:0,
    status:o.status==='Admitted'?'Admitted':'Discharged',admitted_at:ist(o.admissionDate,o.admissionTime||o.time),discharged_at:o.dischargedAt?tsOf(o.dischargedAt):null,discharge_status:o.status==='Admitted'?null:(nul(o.dischargeDisposition)||'Discharged to Home'),created_at:tsOf(o.createdAt,o.systemCreatedAt)||ist(o.admissionDate,''),_charge:+o.procedureCharge||0,_uhid:x.uhid}
  if(!o.sourceOpdNo)note('link','IPD '+o.ipdNo+' ('+x.uhid+') has no OPD number; it was imported without an OPD link')
  adm.push(a);admByIpd.set(o.ipdNo,a)})

// ---------- bills, payments, investigations ----------
const bills=[],pays=[],invs=[],advInv=[]
const mkBill=(o)=>{const b={id:uuid(),bill_no:null,patient_id:null,visit_id:null,admission_id:null,kind:'OPD',items:[],subtotal:0,discount:0,total:0,paid:0,mode:'Cash',bill_date:null,status:'Active',discount_authority:null,issued_by:null,finalized_at:null,finalized_by:null,cancel_reason:null,cancelled_at:null,created_at:null,legacy_ref:null,...o};bills.push(b);return b}
const mkPay=(b,o)=>{const p={id:uuid(),bill_id:b.id,amount:0,mode:'Cash',receipt_no:null,remarks:null,txn_ref:null,issued_by:b.issued_by,is_final:false,created_at:b.created_at,cancelled_at:null,cancel_reason:null,reverses:null,...o};pays.push(p);b.paid=+(b.paid+p.amount).toFixed(2);return p}
const invById=new Map(invoices.map(i=>[i.id,i]))
for(const i of invoices){const own=(/^OPD/.test(i.type)&&visitByOpd.get(i.opdNo)?.r.uhid)||i._uhid;if(own!==i._uhid)note('reassigned','Receipt '+i.id+' (Rs '+i.amount+') was stored under '+i._uhid+' but its OPD number '+i.opdNo+' belongs to '+own+'; moved to '+own)
  const p=pat.get(own),created=tsOf(i.createdAt,i.systemCreatedAt)||ist(i.date,i.time),pm=i.payment||{}
  const base={patient_id:p.id,bill_date:i.date,created_at:created,legacy_ref:i.id,issued_by:staff(i.createdBy)||staff(regByReceipt.get(i.id)?.registeredBy),mode:mode(pm.mode)}
  if(i.type==='OPD Registration'||i.type==='OPD Revisit'){const vr=visitByOpd.get(i.opdNo)
    const amt=+i.amount||0,disc=+i.discount||0,r=regByReceipt.get(i.id)
    const b=mkBill({...base,kind:'OPD',visit_id:vr?.v.id||null,items:(i.items||[]).map(t=>({d:clean(t.name),q:+t.qty||1,r:+t.rate||0})),subtotal:amt+disc,discount:disc,total:amt,discount_authority:nul(r?.authorityName)||nul(r?.otherAuthorityName)})
    if(amt>0)mkPay(b,{amount:amt,mode:mode(pm.mode),txn_ref:nul(pm.utr)});if(/upi/i.test(pm.mode||'')&&!nul(pm.utr)&&amt>0)note('utr','UPI payment without a UTR: '+i.id+' ('+i._uhid+')')}
  else if(i.type==='OPD Investigation'){const vr=visitByOpd.get(i.opdNo),amt=+i.amount||0,disc=+i.discount||0
    const b=mkBill({...base,kind:'Investigation',visit_id:vr?.v.id||null,items:(i.items||[]).map(t=>({d:clean(t.name),q:+t.qty||1,r:+t.rate||0})),subtotal:+i.grossBillAmount||amt+disc,discount:disc,total:amt,discount_authority:null})
    if(amt>0)mkPay(b,{amount:amt,mode:mode(pm.mode),txn_ref:nul(pm.utr)})
    const g=d.patients.find(x=>x.uhid===i._uhid).diagnostics.find(g=>g.receiptId===i.id)
    for(const t of (i.items||[]))invs.push({id:uuid(),patient_id:p.id,context:'OPD',admission_id:null,name:clean(t.name),category:nul(g?.procedureCategory)||'Ophthalmology Investigation',charge:(+t.rate||0)*(+t.qty||1),bill_id:b.id,status:'Done',result:nul(g?.report)||nul(g?.remarks),done_at:created,created_at:created})}
  else if(i.type==='IPD Full & Final'){const a=admByIpd.get(i.ipdNo);if(!a){note('skip','Final bill '+i.id+' has no admission '+i.ipdNo);continue}
    const gross=+i.grossBillAmount||sumItems(i.items),disc=+i.discount||0,net=+i.netAmount
    const b=mkBill({...base,kind:'IPD',admission_id:a.id,items:(i.items||[]).map(t=>({d:clean(t.name),q:+t.qty||1,r:+t.rate||0,c:t.source==='Investigation'?'Investigation':t.source==='Procedure'?'Procedure':'Other'})),subtotal:gross,discount:disc,total:net,finalized_at:tsOf(i.finalizedAt)||created,finalized_by:staff(i.finalizedBy)||staff(i.createdBy)})
    b._ff=i;a._bill=b}
  else if(i.type==='IPD Advance'){advInv.push(i)}
  else note('skip','Unknown invoice type '+i.type)}

// ---------- surgery bookings + advances ----------
const bookById=new Map((d.surgeryBookings||[]).map(b=>[b.id,b]))
for(const i of advInv){const bk=bookById.get(i.bookingId),p=pat.get(i._uhid),created=tsOf(i.createdAt,i.systemCreatedAt)||ist(i.date,i.time),pm=i.payment||{},amt=+i.amount||0
  if(!bk){note('skip','Advance '+i.id+' has no booking');continue}
  const issuer=staff(i.createdBy)
  if(bk.status==='Admitted'&&bk.ipdNo&&admByIpd.get(bk.ipdNo)){ // advance of a patient who was then admitted
    const a=admByIpd.get(bk.ipdNo);a.advance+=amt
    if(!a._bill){a._bill=mkBill({patient_id:a.patient_id,admission_id:a.id,kind:'IPD',bill_date:a.admitted_at.slice(0,10),created_at:a.created_at,legacy_ref:'ADV-'+i.id,issued_by:issuer})}
    a._advances=(a._advances||[]).concat([{i,amt,created,pm,issuer}]);continue}
  const a={id:uuid(),adm_no:null,legacy_no:bk.id,patient_id:p.id,visit_id:null,procedure:clean(bk.procedure),side:'OS',surgeon:doctor(bk.surgeon)||nul(bk.surgeon),bed_id:null,preop:null,category:'Cash',refer_no:null,planned_date:bk.plannedDate||null,advance:amt,status:'Booked',admitted_at:null,discharged_at:null,discharge_status:null,created_at:tsOf(bk.createdAt)||created,_uhid:i._uhid,_booked:true}
  adm.push(a)
  const b=mkBill({patient_id:p.id,admission_id:a.id,kind:'IPD',bill_date:i.date,created_at:created,legacy_ref:i.id,issued_by:issuer,mode:mode(pm.mode)})
  mkPay(b,{amount:amt,mode:mode(pm.mode),txn_ref:nul(pm.utr),remarks:'Advance for surgery booking'});note('booking','Surgery booking '+bk.id+' ('+i._uhid+', planned '+bk.plannedDate+') was imported as a Booked admission; the eye (OD/OS) was not recorded, so OS was set. Please check it.')}
// ---------- IPD final bills: advance, final payment, refund ----------
for(const a of adm.filter(x=>x._bill&&!x._booked)){const b=a._bill,i=b._ff
  for(const ad of (a._advances||[]))mkPay(b,{amount:ad.amt,mode:mode(ad.pm.mode),txn_ref:nul(ad.pm.utr),remarks:'Advance',created_at:ad.created,issued_by:ad.issuer})
  if(i){const recv=+i.amountReceived||0,pm=i.payment||{}
    if(recv>0){const fp=mkPay(b,{amount:recv,mode:mode(pm.mode),txn_ref:nul(pm.utr),is_final:true,remarks:'Final payment'});if(/upi/i.test(pm.mode||'')&&!nul(pm.utr))note('utr','UPI final payment without a UTR: '+i.id+' ('+a._uhid+')')
      for(const h of (i.refundHistory||[])){mkPay(b,{amount:-(+h.amount),mode:mode(pm.mode),remarks:'Refund: '+nul(h.reason),reverses:fp.id,created_at:tsOf(h.createdAt)||b.created_at,issued_by:staff(h.authorizedBy)})}
      if((i.refundHistory||[]).length){b.status='Cancelled';b.cancel_reason='Refunded: '+(nul(i.refundHistory[0].reason)||'');b.cancelled_at=tsOf(i.refundHistory[0].createdAt);note('refund','IPD bill '+i.ipdNo+' ('+a._uhid+') was fully refunded; it is imported as a cancelled bill with a refund entry. Please check.')}}
    if(b.status!=='Cancelled'&&Math.abs(b.paid-b.total)>0.01)note('mismatch','IPD bill '+i.ipdNo+' ('+a._uhid+'): total '+b.total+' but paid '+b.paid)}
  else if(a._charge>0&&a.status==='Admitted'){}}
for(const a of adm.filter(x=>!x._booked&&!x._bill)){
  if(a.status==='Admitted'&&a._charge>0){const b=mkBill({patient_id:a.patient_id,admission_id:a.id,kind:'IPD',bill_date:a.admitted_at.slice(0,10),created_at:a.created_at,items:[{d:a.procedure,q:1,r:a._charge,c:'Procedure'}],subtotal:a._charge,total:a._charge});a._bill=b
    note('admitted','Patient '+a._uhid+' (IPD '+a.legacy_no+', admitted '+a.admitted_at.slice(0,10)+') is still marked Admitted in the old software. It is imported as Admitted in bed Daycare1 with a pending bill of Rs '+a._charge+'. Please check whether this patient should be discharged.')}
  else note('nobill','Admission '+a.legacy_no+' ('+a._uhid+') has no final bill in the old data.')}
// ---------- numbering ----------
for(const a of adm)if(a.status==='Discharged'&&!a.discharged_at)a.discharged_at=a._bill?.finalized_at||a.admitted_at
adm.sort((x,y)=>x.created_at.localeCompare(y.created_at)).forEach((a,k)=>a.adm_no='IPD'+pad(k+1))
let rv=0,rf=0;[...pays].sort((x,y)=>x.created_at.localeCompare(y.created_at)||0).forEach(p=>{p.receipt_no=p.amount<0?'RF'+pad(++rf):'RV'+pad(++rv)})
const perDay={};[...bills].sort((x,y)=>x.created_at.localeCompare(y.created_at)).forEach(b=>{const k=b.bill_date;perDay[k]=(perDay[k]||0)+1;b.bill_no='RCP-'+k.slice(2,4)+k.slice(5,7)+k.slice(8,10)+'-'+pad(perDay[k],3)})
// payment issuers default to the bill issuer
for(const p of pays)if(!p.issued_by){const b=bills.find(x=>x.id===p.bill_id);p.issued_by=b?.issued_by||null}

// ---------- expected totals ----------
const expect={patients:pat.size,visits:visits.length,admissions:adm.length,bills:bills.length,payments:pays.length,investigations:invs.length,
  opdFees:+invoices.filter(i=>/^OPD R/.test(i.type)).reduce((s,i)=>s+(+i.amount||0),0).toFixed(2),
  invFees:+invoices.filter(i=>i.type==='OPD Investigation').reduce((s,i)=>s+(+i.amount||0),0).toFixed(2),
  ipdNet:+invoices.filter(i=>i.type==='IPD Full & Final').reduce((s,i)=>s+(+i.netAmount||0),0).toFixed(2),
  advances:+advInv.reduce((s,i)=>s+(+i.amount||0),0).toFixed(2)}

// ---------- write to the database ----------
const T={patients:{id:'uuid',uhid:'text',legacy_uhid:'text',name:'text',age:'int',sex:'text',phone:'text',address:'text',father_name:'text',relation:'text',created_at:'timestamptz'},
 visits:{id:'uuid',patient_id:'uuid',kind:'text',visit_no:'text',legacy_no:'text',visit_date:'date',consultant:'text',fee:'numeric',discount:'numeric',paid:'numeric',mode:'text',status:'text',token:'int',created_at:'timestamptz'},
 admissions:{id:'uuid',adm_no:'text',legacy_no:'text',patient_id:'uuid',visit_id:'uuid',procedure:'text',side:'text',surgeon:'text',bed_id:'uuid',preop:'text',category:'text',refer_no:'text',planned_date:'date',advance:'numeric',status:'text',admitted_at:'timestamptz',discharged_at:'timestamptz',discharge_status:'text',created_at:'timestamptz'},
 bills:{id:'uuid',bill_no:'text',patient_id:'uuid',visit_id:'uuid',admission_id:'uuid',kind:'text',items:'jsonb',subtotal:'numeric',discount:'numeric',total:'numeric',paid:'numeric',mode:'text',bill_date:'date',status:'text',discount_authority:'text',issued_by:'text',finalized_at:'timestamptz',finalized_by:'text',cancel_reason:'text',cancelled_at:'timestamptz',created_at:'timestamptz',legacy_ref:'text'},
 payments:{id:'uuid',bill_id:'uuid',amount:'numeric',mode:'text',receipt_no:'text',remarks:'text',txn_ref:'text',issued_by:'text',is_final:'boolean',created_at:'timestamptz',cancelled_at:'timestamptz',cancel_reason:'text',reverses:'uuid'},
 investigations:{id:'uuid',patient_id:'uuid',context:'text',admission_id:'uuid',name:'text',category:'text',charge:'numeric',bill_id:'uuid',status:'text',result:'text',done_at:'timestamptz',created_at:'timestamptz'}}
const ins=async(c,t,rows)=>{if(!rows.length)return;const cols=Object.keys(T[t]),def=cols.map(k=>`${k} ${T[t][k]}`).join(','),
  data=rows.map(r=>Object.fromEntries(cols.map(k=>[k,r[k]===undefined?null:r[k]])))
  for(let i=0;i<data.length;i+=500)await c.query(`insert into ${t}(${cols.join(',')}) select ${cols.join(',')} from jsonb_to_recordset($1::jsonb) as x(${def})`,[JSON.stringify(data.slice(i,i+500))])}
const out=[],say=m=>{out.push(m);console.log(m)}
const c=new pg.Client({connectionString:URL,ssl:/localhost|127\.0\.0\.1|host=/.test(URL)?false:{rejectUnauthorized:false}});await c.connect()
const q=async(s,a)=>(await c.query(s,a)).rows
try{
  await c.query('begin')
  const has18=(await q("select count(*)::int n from information_schema.columns where table_name='patients' and column_name='legacy_uhid'"))[0].n
  if(!has18)throw Error('Run supabase/schema_18_legacy.sql in the Supabase SQL Editor first.')
  const cnt=async t=>(await q(`select count(*)::int n from ${t}`))[0].n
  const before={patients:await cnt('patients'),visits:await cnt('visits'),bills:await cnt('bills'),admissions:await cnt('admissions')}
  say(`Database now has: ${before.patients} patients, ${before.visits} visits, ${before.bills} bills, ${before.admissions} admissions.`)
  if(before.patients+before.visits+before.bills+before.admissions>0){
    if(!WIPE)throw Error('The database already contains patient data (test data?). Add --wipe-test-data to delete it first, or stop here.')
    if(COMMIT){const rl=readline.createInterface({input:process.stdin,output:process.stdout});const ans=await rl.question('This permanently deletes ALL existing patients, visits, bills, payments and admissions. Type DELETE TEST DATA to continue: ');rl.close();if(ans.trim()!=='DELETE TEST DATA')throw Error('Cancelled.')}
    const tabs=await q(`with recursive r as (select 'public.patients'::regclass::oid o union select c.conrelid from pg_constraint c join r on c.confrelid=r.o where c.contype='f') select distinct c.relname from r join pg_class c on c.oid=r.o`)
    say('Removing test data from: '+tabs.map(t=>t.relname).join(', '));await c.query('truncate table patients,audit_log restart identity cascade');await c.query("select setval('uhid_seq',1,false)")}
  const bed=(await q("select id from beds where bed_no='Daycare1' and active limit 1"))[0]
  for(const a of adm)if(a.status==='Admitted'){if(!bed)throw Error('Bed Daycare1 was not found.');a.bed_id=bed.id}
  const tabs6=['patients','visits','bills','payments','admissions','investigations']
  for(const t of tabs6)await c.query(`alter table ${t} disable trigger user`)
  await ins(c,'patients',[...pat.values()]);await ins(c,'visits',visits);await ins(c,'admissions',adm);await ins(c,'bills',bills);await ins(c,'payments',pays);await ins(c,'investigations',invs)
  for(const t of tabs6)await c.query(`alter table ${t} enable trigger user`)
  await c.query("select setval('uhid_seq',(select max(uhid::int) from patients),true)")
  // old master lists: keep names that are not in the new list yet
  let added=0;for(const [kind,list] of [['opd_investigation',d.opdInvestigationMaster||[]],['ipd_procedure',d.ipdProcedureMaster||[]]])for(const m of list){const nm=clean(m.name);if(!nm)continue
    const r=await c.query("insert into catalog_items(kind,name,category,active) values($1,$2,$3,true) on conflict (kind,name) do nothing",[kind,nm,nul(m.category)||(kind==='opd_investigation'?'Ophthalmology Investigation':'Ophthalmology Procedure')]);added+=r.rowCount}
  say(`Master list: ${added} old item name(s) were not in the new list and were added.`)
  // ---------- verification ----------
  const got={patients:await cnt('patients'),visits:await cnt('visits'),admissions:await cnt('admissions'),bills:await cnt('bills'),payments:await cnt('payments'),investigations:await cnt('investigations')}
  const sum=async w=>+(await q(`select coalesce(sum(p.amount),0)::numeric s from payments p join bills b on b.id=p.bill_id where ${w}`))[0].s
  const checks=[]
  const chk=(n,ok,i='')=>{checks.push(ok);say((ok?'  OK   ':'  FAIL ')+n+(i?'  '+i:''))}
  say('\nVerification (old file vs database):')
  for(const k of Object.keys(got))chk(k+' count',got[k]===expect[k],`file ${expect[k]} / database ${got[k]}`)
  chk('OPD registration fees collected',Math.abs(await sum("b.kind='OPD'")-expect.opdFees)<.01,`file ₹${expect.opdFees}`)
  chk('OPD investigation fees collected',Math.abs(await sum("b.kind='Investigation'")-expect.invFees)<.01,`file ₹${expect.invFees}`)
  chk('IPD final bill total',Math.abs(+(await q("select coalesce(sum(total),0)::numeric s from bills where kind='IPD' and finalized_at is not null"))[0].s-expect.ipdNet)<.01,`file ₹${expect.ipdNet}`)
  // independent expectations computed straight from the raw file
  const rawInv=[...new Map(d.patients.flatMap(x=>x.invoices).map(i=>[i.id,i])).values()],ffs=rawInv.filter(i=>i.type==='IPD Full & Final'),dis=d.patients.flatMap(x=>x.otipd)
  const nBills=regs.length+rawInv.filter(i=>i.type==='OPD Investigation').length+ffs.length+rawInv.filter(i=>i.type==='IPD Advance'&&bookById.get(i.bookingId)?.status!=='Admitted').length+dis.filter(o=>o.status==='Admitted'&&!ffs.some(f=>f.ipdNo===o.ipdNo)&&(+o.procedureCharge>0)).length
  chk('bill count equals OPD + investigation + IPD final + booking advances + open IPD',got.bills===nBills,`${nBills}`)
  const rawCash=regs.reduce((s,r)=>s+(+r.netAmount||0),0)+rawInv.filter(i=>i.type==='OPD Investigation').reduce((s,i)=>s+(+i.amount||0),0)+ffs.reduce((s,i)=>s+(+i.amountReceived||0),0)+rawInv.filter(i=>i.type==='IPD Advance').reduce((s,i)=>s+(+i.amount||0),0)-ffs.reduce((s,i)=>s+(i.refundHistory||[]).reduce((a,h)=>a+(+h.amount||0),0),0)
  const dbCash=+(await q("select coalesce(sum(amount),0)::numeric s from payments"))[0].s
  chk('total money received (all payments, after refunds)',Math.abs(rawCash-dbCash)<.01,`file ₹${rawCash} / database ₹${dbCash}`)
  const mism=(await q("select count(*)::int n from bills b join visits v on v.id=b.visit_id where v.patient_id<>b.patient_id"))[0].n;chk('every bill belongs to the same patient as its visit',mism===0,mism?mism+' differ':'')
  const bad=(await q("select count(*)::int n from bills b where paid<>coalesce((select sum(amount) from payments where bill_id=b.id),0)"))[0].n;chk('every bill paid amount equals its payments',bad===0,bad?bad+' differ':'')
  const dupNo=(await q("select count(*)::int n from (select receipt_no from payments group by 1 having count(*)>1) x"))[0].n;chk('receipt numbers are unique',dupNo===0)
  const orphan=(await q("select count(*)::int n from visits v left join patients p on p.id=v.patient_id where p.id is null"))[0].n;chk('no visit without a patient',orphan===0)
  const nx=await q("select (select max(visit_no) from visits) v,(select max(adm_no) from admissions) a,(select max(receipt_no) from payments where receipt_no like 'RV%') r,(select last_value from uhid_seq) u")
  say(`\nLast numbers used: UHID ${pad(nx[0].u)}, ${nx[0].v}, ${nx[0].a}, ${nx[0].r}. New entries continue from these.`)
  if(warn.length){say('\nThings to review ('+warn.length+'):');const g={};for(const [k,m] of warn)(g[k]=g[k]||[]).push(m);for(const k of Object.keys(g)){say(`- ${k} (${g[k].length})`);g[k].slice(0,25).forEach(m=>say('    '+m));if(g[k].length>25)say('    ... and '+(g[k].length-25)+' more')}}
  if(!checks.every(Boolean))throw Error('A verification check failed. Nothing was saved.')
  if(COMMIT){await c.query('commit');say('\nCOMMITTED. The data is now in the database.')}else{await c.query('rollback');say('\nDRY RUN finished. Nothing was saved. Add --commit to save for real.')}
}catch(e){try{await c.query('rollback')}catch{}say('\nSTOPPED: '+e.message+' (nothing was saved)');process.exitCode=1}
finally{await c.end();fs.writeFileSync('import-report.txt',out.join('\n')+'\n')}
