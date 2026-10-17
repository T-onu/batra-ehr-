-- Step 11 · OPD auto fee, BEH101 patient numbers, Daycare-only beds, English messages (run after schema_10)

-- 1) OPD consultation fee by India time: Rs 100 from 8:30 AM to 4:00 PM, Rs 200 at all other times
create or replace function public.opd_fee() returns numeric language sql stable as $$
  select case when (now() at time zone 'Asia/Kolkata')::time >= time '08:30' and (now() at time zone 'Asia/Kolkata')::time < time '16:01' then 100 else 200 end $$;

create or replace function public.register_opd(p_patient uuid,p_name text,p_age int,p_sex text,p_phone text,p_address text,p_consultant text,p_discount numeric,p_authority text,p_paid numeric,p_mode text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare pid uuid:=p_patient; u text; v visits%rowtype; fee numeric:=public.opd_fee(); d numeric:=coalesce(p_discount,0); b uuid; today date:=(now() at time zone 'Asia/Kolkata')::date; begin
  if public.my_role() not in ('Reception','Billing','Admin','Super Admin') then raise exception 'Your role cannot register patients'; end if;
  if pid is null then
    if coalesce(trim(p_name),'')='' then raise exception 'Patient name is required'; end if;
    insert into patients(name,age,sex,phone,address) values(trim(p_name),p_age,p_sex,nullif(trim(p_phone),''),nullif(trim(p_address),'')) returning id,uhid into pid,u;
  else select uhid into u from patients where id=pid; if u is null then raise exception 'Patient not found'; end if; end if;
  if d<0 or d>fee then raise exception 'Invalid discount'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'The discount authority name is required'; end if;
  if coalesce(p_paid,0)<0 or coalesce(p_paid,0)>fee-d then raise exception 'Paid amount exceeds the fee'; end if;
  insert into visits(patient_id,kind,consultant,visit_date) values(pid,'OPD',nullif(trim(p_consultant),''),today) returning * into v;
  insert into bills(patient_id,visit_id,kind,items,subtotal,discount,total,mode,discount_authority,bill_date)
    values(pid,v.id,'OPD',jsonb_build_array(jsonb_build_object('d','OPD Consultation','q',1,'r',fee)),fee,d,fee-d,coalesce(p_mode,'Cash'),nullif(trim(p_authority),''),today) returning id into b;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode) values(b,p_paid,coalesce(p_mode,'Cash')); end if;
  return jsonb_build_object('patient_id',pid,'uhid',u,'visit_id',v.id,'visit_no',v.visit_no,'bill_id',b,'fee',fee); end $$;

-- 2) Patient numbers: BEH101, BEH102, ... (existing patients are renumbered in order of registration)
alter table patients alter column uhid set default ('BEH'||nextval('uhid_seq')::text);
update patients set uhid='TMP-'||id::text;   -- step 1: temporary unique names so numbers never collide
with r as (select id,row_number() over(order by created_at,id) n from patients) update patients p set uhid='BEH'||(100+r.n) from r where p.id=r.id;
select setval('uhid_seq',100+(select count(*) from patients),true);

-- 3) Beds: keep only Daycare (beds that already have admissions are hidden instead of deleted)
update beds set active=false where ward<>'Daycare';
delete from beds b where b.ward<>'Daycare' and not exists(select 1 from admissions a where a.bed_id=b.id);

-- 4) Error messages in English (same logic, new wording)
create or replace function public.apply_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare s text; t numeric; p numeric; begin
  select status,total,paid into s,t,p from bills where id=new.bill_id;
  if s='Cancelled' then raise exception 'Payments cannot be taken on a cancelled bill'; end if;
  if new.amount>0 and p+new.amount>t then raise exception 'Payment exceeds the bill balance'; end if;
  if new.amount<0 and p+new.amount<0 then raise exception 'Refund exceeds the amount paid'; end if;
  update bills set paid=paid+new.amount where id=new.bill_id; return new; end $$;

create or replace function public.admission_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; m boolean; yr text:=to_char(current_date,'YYYY'); begin
  if tg_op='INSERT' then perform pg_advisory_xact_lock(hashtext('adm_no'));
    select coalesce(max(right(adm_no,6)::int),0) into n from admissions where adm_no like 'BEH-IPD-'||yr||'-%';
    new.adm_no:='BEH-IPD-'||yr||'-'||lpad((n+1)::text,6,'0'); end if;
  if new.status='Admitted' then
    if new.bed_id is null then raise exception 'A bed is required to admit a patient'; end if;
    if new.admitted_at is null then new.admitted_at:=now(); end if;
    select multi into m from beds where id=new.bed_id;
    if not m and exists(select 1 from admissions where bed_id=new.bed_id and status='Admitted' and id<>new.id) then
      raise exception 'This bed is already occupied'; end if; end if;
  return new; end $$;

create or replace function public.profile_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or tg_op<>'UPDATE' then return new; end if;
  if old.role='Super Admin' and (new.role<>'Super Admin' or not new.active)
     and not exists(select 1 from profiles where role='Super Admin' and active and id<>old.id)
  then raise exception 'The last Super Admin cannot be removed or disabled'; end if;
  if (new.role='Super Admin' or old.role='Super Admin') and (new.role is distinct from old.role or new.active is distinct from old.active)
     and public.my_role() is distinct from 'Super Admin' then raise exception 'Only a Super Admin can make this change'; end if;
  if new.id=auth.uid() and (new.role is distinct from old.role or new.active is distinct from old.active)
  then raise exception 'You cannot change your own role or status'; end if;
  return new; end $$;

create or replace function public.apply_move() returns trigger language plpgsql security definer set search_path=public as $$
declare q int; begin select qty_on_hand into q from stock_items where id=new.stock_id for update;
  if q+new.qty<0 then raise exception 'Insufficient stock (available %)',q; end if;
  update stock_items set qty_on_hand=q+new.qty where id=new.stock_id; return new; end $$;

create or replace function public.stock_purchase(p_module text,p_product text,p_generic text,p_salt text,p_vendor text,p_vphone text,p_batch text,p_expiry date,p_pp numeric,p_mrp numeric,p_qty int,p_date date,p_fs text,p_gt text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid; begin
  if not module_ok(p_module) then raise exception 'You do not have access to this module'; end if;
  if coalesce(trim(p_product),'')='' then raise exception 'Product name is required'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Quantity must be greater than 0'; end if;
  if p_mrp is null or p_mrp<0 or coalesce(p_pp,0)<0 then raise exception 'Invalid price'; end if;
  if p_module='pharmacy' and (p_expiry is null or coalesce(trim(p_batch),'')='') then raise exception 'Batch number and expiry date are required for pharmacy items'; end if;
  insert into stock_items(module,product,generic,salt,vendor,vendor_phone,batch_no,expiry,purchase_price,mrp,frame_size,glass_type,purchase_date)
    values(p_module,trim(p_product),nullif(trim(p_generic),''),nullif(trim(p_salt),''),nullif(trim(p_vendor),''),nullif(trim(p_vphone),''),nullif(trim(p_batch),''),p_expiry,coalesce(p_pp,0),p_mrp,p_fs,p_gt,coalesce(p_date,current_date)) returning id into v;
  insert into stock_moves(stock_id,kind,qty,ref) values(v,'PURCHASE',p_qty,'Purchase: '||coalesce(nullif(trim(p_vendor),''),'—'));
  return v; end $$;

create or replace function public.stock_sale(p_module text,p_patient uuid,p_items jsonb,p_discount numeric,p_authority text,p_paid numeric,p_mode text,p_delivery date)
returns uuid language plpgsql security definer set search_path=public as $$
declare it jsonb; s stock_items%rowtype; q int; sub numeric:=0; tot numeric; items jsonb:='[]'::jsonb; b uuid; d numeric:=coalesce(p_discount,0); begin
  if not module_ok(p_module) then raise exception 'You do not have access to this module'; end if;
  if p_patient is null then raise exception 'Select a patient'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Select at least one item'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
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
    insert into stock_moves(stock_id,kind,qty,bill_id) values((it->>'stock_id')::uuid,'SALE',-((it->>'q')::int),b); end loop;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode) values(b,p_paid,coalesce(p_mode,'Cash')); end if;
  return b; end $$;

create or replace function public.stock_return_patient(p_bill uuid,p_stock uuid,p_qty int,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b bills%rowtype; it jsonb; sold int; done int; rate numeric; amt numeric; ratio numeric; nt numeric; ref numeric; cn text; n int; m text; begin
  select * into b from bills where id=p_bill for update; if not found then raise exception 'Bill not found'; end if;
  m:=lower(b.kind); if m not in ('pharmacy','optical') then raise exception 'This is not a stock bill'; end if;
  if not module_ok(m) then raise exception 'You do not have access to this module'; end if;
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

create or replace function public.stock_remove(p_stock uuid,p_qty int,p_kind text,p_note text) returns void language plpgsql security definer set search_path=public as $$
declare m text; begin select module into m from stock_items where id=p_stock; if m is null then raise exception 'Stock item not found'; end if;
  if not module_ok(m) then raise exception 'You do not have access to this module'; end if;
  if p_kind not in ('VENDOR_RETURN','WRITE_OFF') then raise exception 'Invalid type'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Invalid quantity'; end if;
  if coalesce(trim(p_note),'')='' then raise exception 'A reason or vendor name is required'; end if;
  insert into stock_moves(stock_id,kind,qty,note) values(p_stock,p_kind,-p_qty,trim(p_note)); end $$;

create or replace function public.order_investigations(p_patient uuid,p_ctx text,p_adm uuid,p_items jsonb,p_discount numeric,p_authority text,p_paid numeric,p_mode text)
returns uuid language plpgsql security definer set search_path=public as $$
declare it jsonb; sub numeric:=0; d numeric:=coalesce(p_discount,0); c numeric; b uuid; begin
  if public.my_role() not in ('Reception','Billing','Admin','Super Admin') then raise exception 'Your role cannot create investigation bills'; end if;
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
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode) values(b,p_paid,coalesce(p_mode,'Cash')); end if;
  return b; end $$;
