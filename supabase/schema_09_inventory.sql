-- Step 9 · Pharmacy + Optical stock (pehli 8 SQL files ke baad run karo)
alter table bills add column discount_authority text, add column delivery_date date, add column returned numeric not null default 0;
alter table payments drop constraint payments_amount_check;
alter table payments add constraint payments_amount_nonzero check (amount<>0);   -- negative = refund

create or replace function public.apply_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare s text; t numeric; p numeric; begin
  select status,total,paid into s,t,p from bills where id=new.bill_id;
  if s='Cancelled' then raise exception 'Cancelled bill par payment nahi li ja sakti'; end if;
  if new.amount>0 and p+new.amount>t then raise exception 'Payment bill ke balance se zyada hai'; end if;
  if new.amount<0 and p+new.amount<0 then raise exception 'Refund paid amount se zyada hai'; end if;
  update bills set paid=paid+new.amount where id=new.bill_id; return new; end $$;

create table stock_items(id uuid primary key default gen_random_uuid(), module text not null check (module in ('pharmacy','optical')),
  product text not null, generic text, salt text, vendor text, vendor_phone text, batch_no text, expiry date,
  purchase_price numeric not null default 0, mrp numeric not null check (mrp>=0), frame_size text, glass_type text,
  qty_on_hand int not null default 0 check (qty_on_hand>=0), purchase_date date default current_date,
  created_by uuid default auth.uid(), created_at timestamptz default now());
create index on stock_items(module);
create table stock_moves(id uuid primary key default gen_random_uuid(), stock_id uuid not null references stock_items on delete restrict,
  kind text not null check (kind in ('PURCHASE','SALE','PATIENT_RETURN','VENDOR_RETURN','WRITE_OFF')), qty int not null check (qty<>0),
  bill_id uuid references bills on delete restrict, ref text, note text, created_by uuid default auth.uid(), created_at timestamptz default now());
create index on stock_moves(stock_id);
create table credit_notes(id uuid primary key default gen_random_uuid(), cn_no text unique, module text, bill_id uuid not null references bills,
  patient_id uuid not null references patients, stock_id uuid not null references stock_items, qty int not null check (qty>0),
  amount numeric not null, refund numeric not null default 0, reason text not null, created_by uuid default auth.uid(), created_at timestamptz default now());
create index on credit_notes(bill_id);

create function public.module_ok(m text) returns boolean language sql security definer stable set search_path=public as $$
  select coalesce(public.my_role() in ('Admin','Super Admin','Billing') or (m='pharmacy' and public.my_role()='Pharmacy') or (m='optical' and public.my_role()='Optical'),false) $$;

create function public.apply_move() returns trigger language plpgsql security definer set search_path=public as $$
declare q int; begin select qty_on_hand into q from stock_items where id=new.stock_id for update;
  if q+new.qty<0 then raise exception 'Stock kam hai (available %)',q; end if;
  update stock_items set qty_on_hand=q+new.qty where id=new.stock_id; return new; end $$;
create trigger trg_move after insert on stock_moves for each row execute function public.apply_move();

create function public.stock_purchase(p_module text,p_product text,p_generic text,p_salt text,p_vendor text,p_vphone text,p_batch text,p_expiry date,p_pp numeric,p_mrp numeric,p_qty int,p_date date,p_fs text,p_gt text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid; begin
  if not module_ok(p_module) then raise exception 'Is module ka access nahi hai'; end if;
  if coalesce(trim(p_product),'')='' then raise exception 'Product ka naam zaruri hai'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Quantity 0 se zyada honi chahiye'; end if;
  if p_mrp is null or p_mrp<0 or coalesce(p_pp,0)<0 then raise exception 'Price galat hai'; end if;
  if p_module='pharmacy' and (p_expiry is null or coalesce(trim(p_batch),'')='') then raise exception 'Pharmacy me batch no. aur expiry zaruri hain'; end if;
  insert into stock_items(module,product,generic,salt,vendor,vendor_phone,batch_no,expiry,purchase_price,mrp,frame_size,glass_type,purchase_date)
    values(p_module,trim(p_product),nullif(trim(p_generic),''),nullif(trim(p_salt),''),nullif(trim(p_vendor),''),nullif(trim(p_vphone),''),nullif(trim(p_batch),''),p_expiry,coalesce(p_pp,0),p_mrp,p_fs,p_gt,coalesce(p_date,current_date)) returning id into v;
  insert into stock_moves(stock_id,kind,qty,ref) values(v,'PURCHASE',p_qty,'Purchase: '||coalesce(nullif(trim(p_vendor),''),'—'));
  return v; end $$;

create function public.stock_sale(p_module text,p_patient uuid,p_items jsonb,p_discount numeric,p_authority text,p_paid numeric,p_mode text,p_delivery date)
returns uuid language plpgsql security definer set search_path=public as $$
declare it jsonb; s stock_items%rowtype; q int; sub numeric:=0; tot numeric; items jsonb:='[]'::jsonb; b uuid; d numeric:=coalesce(p_discount,0); begin
  if not module_ok(p_module) then raise exception 'Is module ka access nahi hai'; end if;
  if p_patient is null then raise exception 'Patient select karo'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Kam se kam ek item chuno'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    q:=(it->>'qty')::int; if q is null or q<=0 then raise exception 'Quantity galat hai'; end if;
    select * into s from stock_items where id=(it->>'stock_id')::uuid and module=p_module for update;
    if not found then raise exception 'Stock item nahi mila'; end if;
    if s.qty_on_hand<q then raise exception '% ka stock kam hai (available %)',s.product,s.qty_on_hand; end if;
    if s.expiry is not null and s.expiry<current_date then raise exception '% expired hai (%)',s.product,s.expiry; end if;
    items:=items||jsonb_build_array(jsonb_build_object('d',s.product||coalesce(' ['||nullif(s.batch_no,'')||']',''),'q',q,'r',s.mrp,'stock_id',s.id));
    sub:=sub+q*s.mrp; end loop;
  if d<0 or d>sub then raise exception 'Discount galat hai'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'Discount ke liye authority ka naam zaruri hai'; end if;
  tot:=sub-d; if coalesce(p_paid,0)>tot then raise exception 'Paid amount total se zyada hai'; end if;
  insert into bills(patient_id,kind,items,subtotal,discount,total,mode,discount_authority,delivery_date)
    values(p_patient,case when p_module='pharmacy' then 'Pharmacy' else 'Optical' end,items,sub,d,tot,coalesce(p_mode,'Cash'),nullif(trim(p_authority),''),p_delivery) returning id into b;
  for it in select value from jsonb_array_elements(items) loop
    insert into stock_moves(stock_id,kind,qty,bill_id) values((it->>'stock_id')::uuid,'SALE',-((it->>'q')::int),b); end loop;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode) values(b,p_paid,coalesce(p_mode,'Cash')); end if;
  return b; end $$;

create function public.stock_return_patient(p_bill uuid,p_stock uuid,p_qty int,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b bills%rowtype; it jsonb; sold int; done int; rate numeric; amt numeric; ratio numeric; nt numeric; ref numeric; cn text; n int; m text; begin
  select * into b from bills where id=p_bill for update; if not found then raise exception 'Bill nahi mila'; end if;
  m:=lower(b.kind); if m not in ('pharmacy','optical') then raise exception 'Ye stock bill nahi hai'; end if;
  if not module_ok(m) then raise exception 'Is module ka access nahi hai'; end if;
  if b.status='Cancelled' then raise exception 'Cancelled bill par return nahi ho sakta'; end if;
  if coalesce(trim(p_reason),'')='' then raise exception 'Credit note ke liye reason zaruri hai'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Quantity galat hai'; end if;
  select e into it from jsonb_array_elements(b.items) e where e->>'stock_id'=p_stock::text limit 1;
  if it is null then raise exception 'Ye item is bill me nahi hai'; end if;
  sold:=(it->>'q')::int; rate:=(it->>'r')::numeric;
  select coalesce(sum(qty),0) into done from credit_notes where bill_id=p_bill and stock_id=p_stock;
  if p_qty>sold-done then raise exception 'Sirf % unit return ho sakte hain',sold-done; end if;
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

create function public.stock_remove(p_stock uuid,p_qty int,p_kind text,p_note text) returns void language plpgsql security definer set search_path=public as $$
declare m text; begin select module into m from stock_items where id=p_stock; if m is null then raise exception 'Stock item nahi mila'; end if;
  if not module_ok(m) then raise exception 'Is module ka access nahi hai'; end if;
  if p_kind not in ('VENDOR_RETURN','WRITE_OFF') then raise exception 'Galat type'; end if;
  if p_qty is null or p_qty<=0 then raise exception 'Quantity galat hai'; end if;
  if coalesce(trim(p_note),'')='' then raise exception 'Reason / vendor ka naam zaruri hai'; end if;
  insert into stock_moves(stock_id,kind,qty,note) values(p_stock,p_kind,-p_qty,trim(p_note)); end $$;

alter table stock_items enable row level security; alter table stock_moves enable row level security; alter table credit_notes enable row level security;
create policy "read" on stock_items for select to authenticated using(true);
create policy "admin fix" on stock_items for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read" on stock_moves for select to authenticated using(true);
create policy "read" on credit_notes for select to authenticated using(true);
do $$ declare t text; begin
  foreach t in array array['stock_items','stock_moves','credit_notes'] loop
    execute format('create policy "active only" on %I as restrictive for all to authenticated using (public.is_active()) with check (public.is_active())',t);
    execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function public.audit_trigger()',t);
  end loop; end $$;
