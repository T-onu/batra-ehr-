-- Step 4 · Billing (run after schema, 02 and 03)
create table bills(id uuid primary key default gen_random_uuid(), bill_no text unique,
  patient_id uuid not null references patients on delete restrict, visit_id uuid references visits on delete set null,
  kind text not null default 'OPD', items jsonb not null default '[]',
  subtotal numeric not null default 0, discount numeric not null default 0, total numeric not null default 0, paid numeric not null default 0,
  mode text default 'Cash', bill_date date not null default current_date, created_by uuid default auth.uid(), created_at timestamptz default now());
create table payments(id uuid primary key default gen_random_uuid(), bill_id uuid not null references bills on delete cascade,
  amount numeric not null check (amount>0), mode text default 'Cash', created_by uuid default auth.uid(), created_at timestamptz default now());
create index on bills(bill_date); create index on bills(patient_id); create index on payments(bill_id);

create function public.set_bill_no() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; begin perform pg_advisory_xact_lock(hashtext('bill_no'));
  select count(*) into n from bills where bill_date=new.bill_date;
  new.bill_no:='RCP-'||to_char(new.bill_date,'YYMMDD')||'-'||lpad((n+1)::text,3,'0'); return new; end $$;
create trigger trg_bill_no before insert on bills for each row execute function public.set_bill_no();

create function public.apply_payment() returns trigger language plpgsql security definer set search_path=public as $$
begin update bills set paid=paid+new.amount where id=new.bill_id; return new; end $$;
create trigger trg_payment after insert on payments for each row execute function public.apply_payment();

alter table bills enable row level security; alter table payments enable row level security;
create policy "read" on bills for select to authenticated using(true);
create policy "write" on bills for insert to authenticated with check(public.my_role() in ('Reception','Billing','Admin','Super Admin'));
create policy "del admin" on bills for delete to authenticated using(public.is_admin());
create policy "read" on payments for select to authenticated using(true);
create policy "write" on payments for insert to authenticated with check(public.my_role() in ('Reception','Billing','Admin','Super Admin'));
