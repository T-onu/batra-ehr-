-- Step 16 · Roles (Super Admin, Admin, Doctor, Reception), OPD fee rules, UTR/Txn reference, issuer email, IPD Full & Final bill (run after schema_15)

alter table patients add column father_name text, add column relation text default 'S/O';
alter table admissions add column discharge_status text;
alter table bills add column issued_by text, add column finalized_at timestamptz, add column finalized_by text;
alter table payments add column txn_ref text, add column issued_by text, add column is_final boolean not null default false;

-- who issued each bill / receipt (printed at the bottom of every receipt)
create function public.set_issuer() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.issued_by is null then
  select case when name is null or name=email then email else name||' ('||email||')' end into new.issued_by from profiles where id=auth.uid(); end if; return new; end $$;
create trigger trg_issuer before insert on bills for each row execute function public.set_issuer();
create trigger trg_issuer before insert on payments for each row execute function public.set_issuer();

-- UPI and Card payments need a reference (UPI Txn / UTR number, or card slip number / last 4 digits)
create function public.require_txn_ref() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.amount>0 and new.mode in ('UPI','Card') and coalesce(trim(new.txn_ref),'')='' then raise exception 'A transaction reference is required for UPI and Card payments'; end if; return new; end $$;
create trigger trg_txn_ref before insert on payments for each row execute function public.require_txn_ref();

-- OPD fee: free within 10 days of the last paid visit; under 18 = Rs 100 at any time; otherwise Rs 100 (8:30 AM - 4:00 PM) / Rs 200 (other times)
create function public.opd_fee_info(p_patient uuid,p_age int) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare ist timestamp:=now() at time zone 'Asia/Kolkata'; t time:=(now() at time zone 'Asia/Kolkata')::time; d date:=(now() at time zone 'Asia/Kolkata')::date; a int; last date; begin
  a:=coalesce(p_age,(select age from patients where id=p_patient));
  if p_patient is not null then
    select max(v.visit_date) into last from visits v join bills b on b.visit_id=v.id where v.patient_id=p_patient and v.kind='OPD' and b.kind='OPD' and b.status='Active' and b.total>0 and v.visit_date<=d;
    if last is not null and d-last<=10 then return jsonb_build_object('fee',0,'reason','Free follow-up (last paid visit '||(d-last)||' day(s) ago)'); end if;
  end if;
  if a is not null and a<18 then return jsonb_build_object('fee',100,'reason','Patient is under 18: Rs 100 at any time'); end if;
  if t>=time '08:30' and t<time '16:01' then return jsonb_build_object('fee',100,'reason','Day rate (8:30 AM to 4:00 PM)'); end if;
  return jsonb_build_object('fee',200,'reason','After-hours rate'); end $$;

drop function if exists public.register_opd(uuid,text,int,text,text,text,text,numeric,text,numeric,text);
create function public.register_opd(p_patient uuid,p_name text,p_age int,p_sex text,p_phone text,p_address text,p_consultant text,p_discount numeric,p_authority text,p_paid numeric,p_mode text,p_father text default null,p_relation text default 'S/O',p_ref text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare pid uuid:=p_patient; u text; v visits%rowtype; info jsonb; fee numeric; d numeric:=coalesce(p_discount,0); b uuid; today date:=(now() at time zone 'Asia/Kolkata')::date; begin
  if public.my_role() not in ('Reception','Billing','Admin','Super Admin') then raise exception 'Your role cannot register patients'; end if;
  if pid is not null and not exists(select 1 from patients where id=pid) then raise exception 'Patient not found'; end if;
  info:=public.opd_fee_info(pid,p_age); fee:=(info->>'fee')::numeric;
  if pid is null then
    if coalesce(trim(p_name),'')='' then raise exception 'Patient name is required'; end if;
    insert into patients(name,age,sex,phone,address,father_name,relation) values(trim(p_name),p_age,p_sex,nullif(trim(p_phone),''),nullif(trim(p_address),''),nullif(trim(p_father),''),coalesce(nullif(trim(p_relation),''),'S/O')) returning id,uhid into pid,u;
  else select uhid into u from patients where id=pid; end if;
  if d<0 or d>fee then raise exception 'Invalid discount'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'The discount authority name is required'; end if;
  if coalesce(p_paid,0)<0 or coalesce(p_paid,0)>fee-d then raise exception 'Paid amount exceeds the fee'; end if;
  insert into visits(patient_id,kind,consultant,visit_date) values(pid,'OPD',nullif(trim(p_consultant),''),today) returning * into v;
  insert into bills(patient_id,visit_id,kind,items,subtotal,discount,total,mode,discount_authority,bill_date)
    values(pid,v.id,'OPD',jsonb_build_array(jsonb_build_object('d',case when fee=0 then 'OPD Consultation (free follow-up)' else 'OPD Consultation' end,'q',1,'r',fee)),fee,d,fee-d,coalesce(p_mode,'Cash'),nullif(trim(p_authority),''),today) returning id into b;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode,txn_ref) values(b,p_paid,coalesce(p_mode,'Cash'),nullif(trim(p_ref),'')); end if;
  return jsonb_build_object('patient_id',pid,'uhid',u,'visit_id',v.id,'visit_no',v.visit_no,'bill_id',b,'fee',fee,'reason',info->>'reason'); end $$;

-- who may do what
create function public.sale_ok(m text) returns boolean language sql security definer stable set search_path=public as $$
  select coalesce(public.module_ok(m) or (m='optical' and public.my_role()='Reception'),false) $$;

drop function if exists public.stock_sale(text,uuid,jsonb,numeric,text,numeric,text,date);
create function public.stock_sale(p_module text,p_patient uuid,p_items jsonb,p_discount numeric,p_authority text,p_paid numeric,p_mode text,p_delivery date,p_ref text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare it jsonb; s stock_items%rowtype; q int; sub numeric:=0; tot numeric; items jsonb:='[]'::jsonb; b uuid; d numeric:=coalesce(p_discount,0); begin
  if not public.sale_ok(p_module) then raise exception 'You do not have access to this module'; end if;
  if p_patient is null then raise exception 'Select a patient'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Select at least one item'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if coalesce((it->>'custom')::boolean,false) then
      if coalesce(trim(it->>'name'),'')='' then raise exception 'Custom item name is required'; end if;
      q:=(it->>'qty')::int; if q is null or q<=0 then raise exception 'Invalid quantity'; end if;
      if coalesce((it->>'rate')::numeric,-1)<0 then raise exception 'Invalid price'; end if;
      items:=items||jsonb_build_array(jsonb_build_object('d',trim(it->>'name'),'q',q,'r',(it->>'rate')::numeric,'custom',true));
      sub:=sub+q*(it->>'rate')::numeric; continue; end if;
    q:=(it->>'qty')::int; if q is null or q<=0 then raise exception 'Invalid quantity'; end if;
    select * into s from stock_items where id=(it->>'stock_id')::uuid and module=p_module for update;
    if not found then raise exception 'Stock item not found'; end if;
    if s.qty_on_hand<q then raise exception 'Insufficient stock for % (available %)',s.product,s.qty_on_hand; end if;
    if s.expiry is not null and s.expiry<current_date then raise exception '% has expired (%)',s.product,s.expiry; end if;
    items:=items||jsonb_build_array(jsonb_build_object('d',s.product||coalesce(' ['||nullif(s.batch_no,'')||']',''),'q',q,'r',s.mrp,'stock_id',s.id));
    sub:=sub+q*s.mrp; end loop;
  if d<0 or d>sub then raise exception 'Invalid discount'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'The discount authority name is required'; end if;
  tot:=sub-d; if coalesce(p_paid,0)>tot then raise exception 'Paid amount exceeds the total'; end if;
  insert into bills(patient_id,kind,items,subtotal,discount,total,mode,discount_authority,delivery_date)
    values(p_patient,case when p_module='pharmacy' then 'Pharmacy' else 'Optical' end,items,sub,d,tot,coalesce(p_mode,'Cash'),nullif(trim(p_authority),''),p_delivery) returning id into b;
  for it in select value from jsonb_array_elements(items) loop
    if it->>'stock_id' is null then continue; end if; insert into stock_moves(stock_id,kind,qty,bill_id) values((it->>'stock_id')::uuid,'SALE',-((it->>'q')::int),b); end loop;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode,txn_ref) values(b,p_paid,coalesce(p_mode,'Cash'),nullif(trim(p_ref),'')); end if;
  return b; end $$;
create or replace function public.stock_return_patient(p_bill uuid,p_stock uuid,p_qty int,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b bills%rowtype; it jsonb; sold int; done int; rate numeric; amt numeric; ratio numeric; nt numeric; ref numeric; cn text; n int; m text; begin
  select * into b from bills where id=p_bill for update; if not found then raise exception 'Bill not found'; end if;
  m:=lower(b.kind); if m not in ('pharmacy','optical') then raise exception 'This is not a stock bill'; end if;
  if not public.sale_ok(m) then raise exception 'You do not have access to this module'; end if;
  if b.status='Cancelled' then raise exception 'Items on a cancelled bill cannot be returned'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'A reason is required for the credit note'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Invalid quantity'; end if;
  select e into it from jsonb_array_elements(b.items) e where e->>'stock_id'=p_stock::text limit 1;
  if it is null then raise exception 'This item is not on the bill'; end if;
  sold:=(it->>'q')::int; rate:=(it->>'r')::numeric;
  select coalesce(sum(qty),0) into done from credit_notes where bill_id=p_bill and stock_id=p_stock;
  if p_qty>sold-done then raise exception 'Only % unit(s) can be returned',sold-done; end if;
  ratio:=case when b.subtotal>0 then (b.subtotal-b.discount)/b.subtotal else 1 end;
  amt:=round(p_qty*rate*ratio,2); nt:=b.total-amt; ref:=greatest(0,b.paid-nt);
  perform pg_advisory_xact_lock(hashtext('cn_no'));
  select count(*) into n from credit_notes where created_at::date=current_date;
  cn:='CN-'||to_char(current_date,'YYMMDD')||'-'||lpad((n+1)::text,3,'0');
  insert into credit_notes(cn_no,module,bill_id,patient_id,stock_id,qty,amount,refund,reason) values(cn,m,p_bill,b.patient_id,p_stock,p_qty,amt,ref,trim(p_reason));
  insert into stock_moves(stock_id,kind,qty,bill_id,ref) values(p_stock,'PATIENT_RETURN',p_qty,p_bill,cn);
  update bills set total=nt,returned=returned+amt where id=p_bill;
  if ref>0 then insert into payments(bill_id,amount,mode) values(p_bill,-ref,'Cash'); end if;
  return jsonb_build_object('cn_no',cn,'amount',amt,'refund',ref); end $$;
drop function if exists public.order_investigations(uuid,text,uuid,jsonb,numeric,text,numeric,text);
create function public.order_investigations(p_patient uuid,p_ctx text,p_adm uuid,p_items jsonb,p_discount numeric,p_authority text,p_paid numeric,p_mode text,p_ref text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare it jsonb; sub numeric:=0; d numeric:=coalesce(p_discount,0); c numeric; b uuid; begin
  if public.my_role() not in ('Doctor','Billing','Admin','Super Admin') then raise exception 'Your role cannot create investigation bills'; end if;
  if public.my_role()='Doctor' and (coalesce(p_paid,0)>0 or coalesce(p_discount,0)>0) then raise exception 'Doctors cannot take payments or give discounts'; end if;
  if p_ctx not in ('OPD','IPD') then raise exception 'Select OPD or IPD'; end if;
  if p_ctx='IPD' and (p_adm is null or not exists(select 1 from admissions where id=p_adm and patient_id=p_patient and status in ('Admitted','Discharged')))
    then raise exception 'Select this patient''s admission for an IPD order'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Select at least one item'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if coalesce(trim(it->>'name'),'')='' then raise exception 'Item name is required'; end if;
    c:=(it->>'charge')::numeric; if c is null or c<0 then raise exception 'Enter a charge for every item'; end if; sub:=sub+c; end loop;
  if d<0 or d>sub then raise exception 'Invalid discount'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'The discount authority name is required'; end if;
  if coalesce(p_paid,0)>sub-d then raise exception 'Paid amount exceeds the total'; end if;
  insert into bills(patient_id,kind,items,subtotal,discount,total,mode,discount_authority)
    values(p_patient,case p_ctx when 'OPD' then 'Investigation' else 'IPD Procedure' end,
      (select jsonb_agg(jsonb_build_object('d',x->>'name','q',1,'r',(x->>'charge')::numeric)) from jsonb_array_elements(p_items) x),
      sub,d,sub-d,coalesce(p_mode,'Cash'),nullif(trim(p_authority),'')) returning id into b;
  insert into investigations(patient_id,context,admission_id,name,category,charge,bill_id)
    select p_patient,p_ctx,case when p_ctx='IPD' then p_adm end,x->>'name',x->>'category',(x->>'charge')::numeric,b from jsonb_array_elements(p_items) x;
  update bills set admission_id=case when p_ctx='IPD' then p_adm end where id=b;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode,txn_ref) values(b,p_paid,coalesce(p_mode,'Cash'),nullif(trim(p_ref),'')); end if;
  return b; end $$;

drop function if exists public.receive_payment(uuid,uuid,numeric,text,text);
create function public.receive_payment(p_patient uuid,p_bill uuid,p_amount numeric,p_mode text,p_remarks text,p_ref text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare rno text; remain numeric:=p_amount; b record; take numeric; cnt int:=0; begin
  if public.my_role() not in ('Billing','Admin','Super Admin') then raise exception 'Your role cannot receive payments'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Enter an amount greater than 0'; end if;
  rno:=public.next_receipt_no('RV');
  if p_bill is not null then
    if not exists(select 1 from bills where id=p_bill and patient_id=p_patient) then raise exception 'Bill not found for this patient'; end if;
    insert into payments(bill_id,amount,mode,remarks,receipt_no,txn_ref) values(p_bill,p_amount,coalesce(p_mode,'Cash'),nullif(trim(p_remarks),''),rno,nullif(trim(p_ref),'')); cnt:=1;
  else
    for b in select id,total-paid as due from bills where patient_id=p_patient and status='Active' and total-paid>0 order by created_at,id loop
      exit when remain<=0; take:=least(b.due,remain);
      insert into payments(bill_id,amount,mode,remarks,receipt_no,txn_ref) values(b.id,take,coalesce(p_mode,'Cash'),nullif(trim(p_remarks),''),rno,nullif(trim(p_ref),'')); remain:=remain-take; cnt:=cnt+1; end loop;
    if remain>0 then raise exception 'Amount exceeds the total pending dues'; end if;
  end if;
  return jsonb_build_object('receipt_no',rno,'amount',p_amount,'rows',cnt); end $$;

drop function if exists public.ipd_add_service(uuid,jsonb,numeric,text);
create function public.ipd_add_service(p_adm uuid,p_items jsonb,p_discount numeric default 0,p_authority text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare a admissions%rowtype; b bills%rowtype; it jsonb; add_sub numeric:=0; d numeric:=coalesce(p_discount,0); new_items jsonb; begin
  if public.my_role() not in ('Billing','Admin','Super Admin') then raise exception 'Your role cannot add IPD services'; end if;
  select * into a from admissions where id=p_adm; if not found then raise exception 'Admission not found'; end if;
  if a.status not in ('Admitted','Discharged') then raise exception 'Services can only be added for an admitted or discharged patient'; end if;
  select * into b from bills where admission_id=p_adm and kind='IPD' and status='Active' order by created_at limit 1 for update;
  if not found then insert into bills(patient_id,admission_id,kind,items,subtotal,discount,total,mode) values(a.patient_id,p_adm,'IPD','[]'::jsonb,0,0,0,'Cash') returning * into b; end if;
  if b.finalized_at is not null then raise exception 'This IPD bill is already finalized'; end if;
  new_items:=b.items;
  for it in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(trim(it->>'d'),'')='' then raise exception 'Service name is required'; end if;
    if coalesce((it->>'q')::numeric,0)<=0 or coalesce((it->>'r')::numeric,-1)<0 then raise exception 'Enter a valid quantity and rate'; end if;
    new_items:=new_items||jsonb_build_array(jsonb_build_object('d',trim(it->>'d'),'q',(it->>'q')::numeric,'r',(it->>'r')::numeric,'c',coalesce(nullif(trim(it->>'c'),''),'Other')));
    add_sub:=add_sub+(it->>'q')::numeric*(it->>'r')::numeric; end loop;
  if d<0 or d>(b.subtotal+add_sub-b.discount) then raise exception 'Invalid discount'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'The discount authority name is required'; end if;
  update bills set items=new_items,subtotal=b.subtotal+add_sub,discount=b.discount+d,total=b.subtotal+add_sub-(b.discount+d),
    discount_authority=coalesce(nullif(trim(p_authority),''),b.discount_authority) where id=b.id;
  return b.id; end $$;

-- IPD Consolidated Full & Final Bill: applies a last discount, takes the final payment, requires a zero balance, discharges and locks the bill
create function public.ipd_finalize(p_adm uuid,p_discount numeric,p_authority text,p_paid numeric,p_mode text,p_ref text,p_status text) returns uuid language plpgsql security definer set search_path=public as $$
declare ib uuid; rno text; remain numeric:=coalesce(p_paid,0); r record; take numeric; due numeric; who text; begin
  if public.my_role() not in ('Billing','Admin','Super Admin') then raise exception 'Your role cannot finalize an IPD bill'; end if;
  if (select status from admissions where id=p_adm) not in ('Admitted','Discharged') then raise exception 'Only an admitted or discharged patient can be finalized'; end if;
  if exists(select 1 from bills where admission_id=p_adm and finalized_at is not null) then raise exception 'This IPD bill is already finalized'; end if;
  ib:=public.ipd_add_service(p_adm,'[]'::jsonb,p_discount,p_authority);
  if remain>0 then
    rno:=public.next_receipt_no('RV');
    for r in select id,total-paid as due from bills where admission_id=p_adm and status='Active' and total-paid>0 order by created_at,id loop
      exit when remain<=0; take:=least(r.due,remain);
      insert into payments(bill_id,amount,mode,remarks,receipt_no,txn_ref,is_final) values(r.id,take,coalesce(p_mode,'Cash'),'Final payment',rno,nullif(trim(p_ref),''),true); remain:=remain-take; end loop;
    if remain>0 then raise exception 'Payment is more than the balance'; end if;
  end if;
  select coalesce(sum(total-paid),0) into due from bills where admission_id=p_adm and status='Active';
  if due<>0 then raise exception 'The balance must be zero to finalize (current balance: %). Collect the payment or refund the advance first.',due; end if;
  select case when name is null or name=email then email else name||' ('||email||')' end into who from profiles where id=auth.uid();
  update admissions set status='Discharged',discharged_at=coalesce(discharged_at,now()),discharge_status=coalesce(nullif(trim(p_status),''),discharge_status,'Discharged to Home') where id=p_adm;
  update bills set finalized_at=now(),finalized_by=who where admission_id=p_adm and status='Active';
  return ib; end $$;

-- Staff & Roles and the Audit Log belong to the Super Admin only
drop policy if exists "admin manage" on profiles;
create policy "super manage" on profiles for all to authenticated using(public.my_role()='Super Admin') with check(public.my_role()='Super Admin');
drop policy if exists "admin read" on audit_log;
create policy "super read" on audit_log for select to authenticated using(public.my_role()='Super Admin');

-- Only four roles remain: Super Admin, Admin, Doctor, Reception.
-- Existing staff with old roles are mapped: Billing/Pharmacy/Sync -> Admin, Optical -> Reception.
alter table profiles disable trigger user;
update profiles set role='Admin' where role in ('Billing','Pharmacy','Sync');
update profiles set role='Reception' where role='Optical';
alter table profiles enable trigger user;
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('Super Admin','Admin','Doctor','Reception'));
