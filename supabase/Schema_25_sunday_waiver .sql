-- Step 25 · Sunday OPD fee Rs 200, and an ECHS / Insurance / Other category with its number on OPD investigation & procedure orders
-- (the category is only a label with a number; discount and payment are entered as before).
alter table bills add column if not exists fee_category text;
drop function if exists public.opd_fee_info(uuid,int,text);
create function public.opd_fee_info(p_patient uuid,p_age int,p_consultant text default null) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t time:=(now() at time zone 'Asia/Kolkata')::time; d date:=(now() at time zone 'Asia/Kolkata')::date; a int; last date; begin
  a:=coalesce(p_age,(select age from patients where id=p_patient));
  if p_patient is not null then
    select max(v.visit_date) into last from visits v join bills b on b.visit_id=v.id
      where v.patient_id=p_patient and v.kind='OPD' and b.kind='OPD' and b.status='Active' and b.total>0 and v.visit_date<=d
        and (nullif(trim(coalesce(p_consultant,'')),'') is null or v.consultant is null or v.consultant=trim(p_consultant));
    if last is not null and d-last<=10 then return jsonb_build_object('fee',0,'reason','Free follow-up with '||coalesce(nullif(trim(p_consultant),''),'the same consultant')||' (last paid visit '||(d-last)||' day(s) ago)'); end if;
  end if;
  if extract(dow from d)=0 then return jsonb_build_object('fee',200,'reason','Sunday rate: Rs 200'); end if;
  if a is not null and a<18 then return jsonb_build_object('fee',100,'reason','Patient is under 18: Rs 100 at any time'); end if;
  if t>=time '08:30' and t<time '16:01' then return jsonb_build_object('fee',100,'reason','Day rate (8:30 AM to 4:00 PM)'); end if;
  return jsonb_build_object('fee',200,'reason','After-hours rate'); end $$;

drop function if exists public.order_investigations(uuid,text,uuid,jsonb,numeric,text,numeric,text,text,text);
drop function if exists public.order_investigations(uuid,text,uuid,jsonb,numeric,text,numeric,text,text,text,text,text);
create function public.order_investigations(p_patient uuid,p_ctx text,p_adm uuid,p_items jsonb,p_discount numeric,p_authority text,p_paid numeric,p_mode text,p_ref text default null,p_remarks text default null,p_category text default null,p_waiver_ref text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare it jsonb; sub numeric:=0; d numeric:=coalesce(p_discount,0); c numeric; b uuid; cat text:=nullif(trim(coalesce(p_category,'')),''); begin
  if public.my_role() not in ('Doctor','Billing','Admin','Super Admin') then raise exception 'Your role cannot create investigation bills'; end if;
  if public.my_role()='Doctor' and (coalesce(p_paid,0)>0 or coalesce(p_discount,0)>0) then raise exception 'Doctors cannot take payments or give discounts'; end if;
  if p_ctx not in ('OPD','IPD') then raise exception 'Select OPD or IPD'; end if;
  if p_ctx='IPD' and (p_adm is null or not exists(select 1 from admissions where id=p_adm and patient_id=p_patient and status in ('Admitted','Discharged')))
    then raise exception 'Select this patient''s admission for an IPD order'; end if;
  if cat is not null and cat not in ('ECHS','Insurance','Other') then raise exception 'Unknown fee category'; end if;
  if cat in ('ECHS','Insurance') and nullif(trim(coalesce(p_waiver_ref,'')),'') is null then raise exception '% number is required',case when cat='ECHS' then 'ECHS card / reference' else 'Insurance policy / claim' end; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Select at least one item'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if coalesce(trim(it->>'name'),'')='' then raise exception 'Item name is required'; end if;
    c:=(it->>'charge')::numeric; if c is null or c<0 then raise exception 'Enter a charge for every item'; end if; sub:=sub+c; end loop;
  if d<0 or d>sub then raise exception 'Invalid discount'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'The discount authority name is required'; end if;
  if coalesce(p_paid,0)>sub-d then raise exception 'Paid amount exceeds the total'; end if;
  insert into bills(patient_id,kind,items,subtotal,discount,total,mode,discount_authority,remarks,fee_category,waiver_ref)
    values(p_patient,case p_ctx when 'OPD' then 'Investigation' else 'IPD Procedure' end,
      (select jsonb_agg(jsonb_build_object('d',x->>'name','q',1,'r',(x->>'charge')::numeric)) from jsonb_array_elements(p_items) x),
      sub,d,sub-d,coalesce(p_mode,'Cash'),nullif(trim(p_authority),''),nullif(trim(p_remarks),''),cat,nullif(trim(p_waiver_ref),'')) returning id into b;
  insert into investigations(patient_id,context,admission_id,name,category,charge,bill_id)
    select p_patient,p_ctx,case when p_ctx='IPD' then p_adm end,x->>'name',x->>'category',(x->>'charge')::numeric,b from jsonb_array_elements(p_items) x;
  update bills set admission_id=case when p_ctx='IPD' then p_adm end where id=b;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode,txn_ref) values(b,p_paid,coalesce(p_mode,'Cash'),nullif(trim(p_ref),'')); end if;
  return b; end $$;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.sync_export(text,text,int,int) to anon;

create or replace view export.opd_investigations as
select b.created_at as "_ts", b.id::text as "_id",
  b.bill_date as "Date", to_char(b.created_at at time zone 'Asia/Kolkata','HH24:MI') as "Time", p.uhid as "UHID", p.legacy_uhid as "Old UHID", p.name as "Patient", p.age as "Age", p.sex as "Sex", p.phone as "Phone",
  v.visit_no as "OPD No", (select string_agg(x->>'d',' + ') from jsonb_array_elements(b.items) x) as "Investigation / Procedure",
  b.subtotal as "Charge", b.discount as "Discount", b.total as "Net amount", b.paid as "Paid", b.total-b.paid as "Balance",
  pay.modes as "Payment mode", pay.utrs as "Txn / UTR", pay.receipts as "Receipt No", b.bill_no as "Bill No", b.issued_by as "Created by", b.status as "Status", b.remarks as "Remarks", b.fee_category as "Fee category", b.waiver_ref as "ECHS / Insurance No"
from public.bills b join public.patients p on p.id=b.patient_id left join public.visits v on v.id=b.visit_id
left join lateral (select string_agg(distinct x.mode,', ') modes, string_agg(distinct nullif(x.txn_ref,''),', ') utrs, string_agg(distinct x.receipt_no,', ') receipts
  from public.payments x where x.bill_id=b.id and x.amount>0) pay on true
where b.kind='Investigation';