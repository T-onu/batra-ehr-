-- Step 13 · OPD000001 / IPD000001 numbers, 50 Daycare beds, payment receipts by UHID / OPD / IPD number, IPD running bill (run after schema_12)

-- 1) Visit and admission numbers
create or replace function public.set_visit_no() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; y int; pre text:=new.kind; begin perform pg_advisory_xact_lock(hashtext('visit_no'));
  select count(*) into n from visits where kind=new.kind and visit_date=new.visit_date;
  select coalesce(max(substring(visit_no from '^'||pre||'([0-9]+)$')::int),0) into y from visits where visit_no ~ ('^'||pre||'[0-9]+$');
  new.visit_no:=pre||lpad((y+1)::text,6,'0');
  if new.kind='OPD' then new.token:=n+1; end if; return new; end $$;
create or replace function public.admission_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; m boolean; yr text:=to_char(current_date,'YYYY'); begin
  if tg_op='INSERT' then perform pg_advisory_xact_lock(hashtext('adm_no'));
    select coalesce(max(substring(adm_no from '^IPD([0-9]+)$')::int),0) into n from admissions where adm_no ~ '^IPD[0-9]+$';
    new.adm_no:='IPD'||lpad((n+1)::text,6,'0'); end if;
  if new.status='Admitted' then
    if new.bed_id is null then raise exception 'A bed is required to admit a patient'; end if;
    if new.admitted_at is null then new.admitted_at:=now(); end if;
    select multi into m from beds where id=new.bed_id;
    if not m and exists(select 1 from admissions where bed_id=new.bed_id and status='Admitted' and id<>new.id) then
      raise exception 'This bed is already occupied'; end if; end if;
  return new; end $$;
update visits set visit_no='TMP-'||id::text where visit_no !~ '^(OPD|IPD)[0-9]+$';
with r as (select id,kind,row_number() over(partition by kind order by created_at,id) n from visits where visit_no like 'TMP-%') update visits v set visit_no=r.kind||lpad(r.n::text,6,'0') from r where v.id=r.id;
update admissions set adm_no='TMP-'||id::text where adm_no !~ '^IPD[0-9]+$';
with r as (select id,row_number() over(order by created_at,id) n from admissions where adm_no like 'TMP-%') update admissions a set adm_no='IPD'||lpad(r.n::text,6,'0') from r where a.id=r.id;

-- 2) Beds: Daycare1 ... Daycare50, one patient per bed
update beds set active=false where not (ward='Daycare' and bed_no ~ '^Daycare[0-9]+$');
delete from beds b where not (b.ward='Daycare' and b.bed_no ~ '^Daycare[0-9]+$') and not exists(select 1 from admissions a where a.bed_id=b.id);
insert into beds(ward,bed_no,multi) select 'Daycare','Daycare'||g,false from generate_series(1,50) g on conflict (ward,bed_no) do nothing;

-- 3) Receipt vouchers: every payment gets a receipt number (RV000001), cancelled receipts keep a reversal entry (RF000001)
alter table payments add column receipt_no text, add column remarks text, add column cancelled_at timestamptz, add column cancelled_by uuid, add column cancel_reason text, add column reverses uuid references payments(id);
with r as (select id,amount>0 pos,row_number() over(partition by amount>0 order by created_at,id) n from payments)
  update payments p set receipt_no=case when r.pos then 'RV' else 'RF' end||lpad(r.n::text,6,'0') from r where p.id=r.id;
create index on payments(receipt_no);
alter table bills add column admission_id uuid references admissions on delete set null; create index on bills(admission_id);

create function public.next_receipt_no(pre text) returns text language plpgsql security definer set search_path=public as $$
declare n int; begin perform pg_advisory_xact_lock(hashtext('receipt_no'));
  select coalesce(max(substring(receipt_no from '^'||pre||'([0-9]+)$')::int),0) into n from payments where receipt_no ~ ('^'||pre||'[0-9]+$');
  return pre||lpad((n+1)::text,6,'0'); end $$;
create function public.set_receipt_no() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.receipt_no is null then new.receipt_no:=public.next_receipt_no(case when new.amount>0 then 'RV' else 'RF' end); end if; return new; end $$;
create trigger trg_receipt_no before insert on payments for each row execute function public.set_receipt_no();

-- an open IPD bill can hold an advance (paid > total) while the patient is booked or admitted
create or replace function public.apply_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare s text; t numeric; p numeric; k text; ad uuid; ast text; begin
  select status,total,paid,kind,admission_id into s,t,p,k,ad from bills where id=new.bill_id;
  if s='Cancelled' and new.amount>0 then raise exception 'Payments cannot be taken on a cancelled bill'; end if;
  if new.amount>0 and p+new.amount>t then
    select status into ast from admissions where id=ad;
    if not (k='IPD' and ad is not null and ast in ('Booked','Admitted')) then raise exception 'Payment exceeds the bill balance'; end if;
  end if;
  if new.amount<0 and p+new.amount<0 then raise exception 'Refund exceeds the amount paid'; end if;
  update bills set paid=paid+new.amount where id=new.bill_id; return new; end $$;

create function public.receive_payment(p_patient uuid,p_bill uuid,p_amount numeric,p_mode text,p_remarks text) returns jsonb language plpgsql security definer set search_path=public as $$
declare rno text; remain numeric:=p_amount; b record; take numeric; cnt int:=0; begin
  if public.my_role() not in ('Reception','Billing','Admin','Super Admin') then raise exception 'Your role cannot receive payments'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'Enter an amount greater than 0'; end if;
  rno:=public.next_receipt_no('RV');
  if p_bill is not null then
    if not exists(select 1 from bills where id=p_bill and patient_id=p_patient) then raise exception 'Bill not found for this patient'; end if;
    insert into payments(bill_id,amount,mode,remarks,receipt_no) values(p_bill,p_amount,coalesce(p_mode,'Cash'),nullif(trim(p_remarks),''),rno); cnt:=1;
  else
    for b in select id,total-paid as due from bills where patient_id=p_patient and status='Active' and total-paid>0 order by created_at,id loop
      exit when remain<=0; take:=least(b.due,remain);
      insert into payments(bill_id,amount,mode,remarks,receipt_no) values(b.id,take,coalesce(p_mode,'Cash'),nullif(trim(p_remarks),''),rno); remain:=remain-take; cnt:=cnt+1; end loop;
    if remain>0 then raise exception 'Amount exceeds the total pending dues'; end if;
  end if;
  return jsonb_build_object('receipt_no',rno,'amount',p_amount,'rows',cnt); end $$;

create function public.cancel_receipt(p_receipt text,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare r record; rno text; tot numeric:=0; begin
  if not public.is_admin() then raise exception 'Only an Admin can cancel a receipt'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'A reason is required to cancel a receipt'; end if;
  if not exists(select 1 from payments where receipt_no=p_receipt and amount>0 and cancelled_at is null) then raise exception 'Receipt not found or already cancelled'; end if;
  rno:=public.next_receipt_no('RF');
  for r in select * from payments where receipt_no=p_receipt and amount>0 and cancelled_at is null for update loop
    update payments set cancelled_at=now(),cancelled_by=auth.uid(),cancel_reason=trim(p_reason) where id=r.id;
    insert into payments(bill_id,amount,mode,remarks,receipt_no,reverses) values(r.bill_id,-r.amount,r.mode,'Cancelled '||p_receipt||': '||trim(p_reason),rno,r.id); tot:=tot+r.amount; end loop;
  return jsonb_build_object('refund_no',rno,'amount',tot); end $$;

-- 4) IPD running bill: add services at any time during the stay; advances are payments on the same bill
create function public.ipd_add_service(p_adm uuid,p_items jsonb,p_discount numeric default 0,p_authority text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare a admissions%rowtype; b bills%rowtype; it jsonb; add_sub numeric:=0; d numeric:=coalesce(p_discount,0); new_items jsonb; begin
  if public.my_role() not in ('Reception','Billing','Admin','Super Admin') then raise exception 'Your role cannot add IPD services'; end if;
  select * into a from admissions where id=p_adm; if not found then raise exception 'Admission not found'; end if;
  if a.status not in ('Admitted','Discharged') then raise exception 'Services can only be added for an admitted or discharged patient'; end if;
  select * into b from bills where admission_id=p_adm and kind='IPD' and status='Active' order by created_at limit 1 for update;
  if not found then insert into bills(patient_id,admission_id,kind,items,subtotal,discount,total,mode) values(a.patient_id,p_adm,'IPD','[]'::jsonb,0,0,0,'Cash') returning * into b; end if;
  new_items:=b.items;
  for it in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    if coalesce(trim(it->>'d'),'')='' then raise exception 'Service name is required'; end if;
    if coalesce((it->>'q')::numeric,0)<=0 or coalesce((it->>'r')::numeric,-1)<0 then raise exception 'Enter a valid quantity and rate'; end if;
    new_items:=new_items||jsonb_build_array(jsonb_build_object('d',trim(it->>'d'),'q',(it->>'q')::numeric,'r',(it->>'r')::numeric));
    add_sub:=add_sub+(it->>'q')::numeric*(it->>'r')::numeric; end loop;
  if d<0 or d>add_sub then raise exception 'Invalid discount'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'The discount authority name is required'; end if;
  update bills set items=new_items,subtotal=b.subtotal+add_sub,discount=b.discount+d,total=b.subtotal+add_sub-(b.discount+d),
    discount_authority=coalesce(nullif(trim(p_authority),''),b.discount_authority) where id=b.id;
  return b.id; end $$;

-- 5) IPD investigation orders are linked to the admission, so they show up under the IPD number
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
  update bills set admission_id=case when p_ctx='IPD' then p_adm end where id=b;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode) values(b,p_paid,coalesce(p_mode,'Cash')); end if;
  return b; end $$;
