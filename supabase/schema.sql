-- Batra Eye EHR · v23 · run in Supabase SQL Editor
create table profiles(id uuid primary key references auth.users on delete cascade, name text, role text not null default 'Reception', created_at timestamptz default now());
create sequence uhid_seq start 1;
create table patients(id uuid primary key default gen_random_uuid(),
  uhid text unique not null default ('BEH-'||lpad(nextval('uhid_seq')::text,6,'0')),
  name text not null, age int, sex text, phone text, address text, created_at timestamptz default now());
create table visits(id uuid primary key default gen_random_uuid(), patient_id uuid not null references patients on delete cascade,
  kind text not null check (kind in ('OPD','IPD')), visit_no text unique, visit_date date not null default current_date, consultant text,
  fee numeric default 0, discount numeric default 0, paid numeric default 0, mode text default 'Cash',
  created_by uuid default auth.uid(), created_at timestamptz default now());
create index on visits(visit_date); create index on patients(phone);

-- central daily numbering: OPD-260915-001 (no duplicates even with many PCs)
create function set_visit_no() returns trigger language plpgsql as $$
begin perform pg_advisory_xact_lock(hashtext('visit_no'));
  new.visit_no := new.kind||'-'||to_char(new.visit_date,'YYMMDD')||'-'||
    lpad(((select count(*) from visits where kind=new.kind and visit_date=new.visit_date)+1)::text,3,'0');
  return new; end $$;
create trigger trg_visit_no before insert on visits for each row execute function set_visit_no();

-- auto profile on signup
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin insert into profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',new.email)); return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function handle_new_user();

-- RLS: logged-in staff only (role-wise rights agle step me tighten karenge)
alter table profiles enable row level security; alter table patients enable row level security; alter table visits enable row level security;
create policy "staff all" on patients for all to authenticated using(true) with check(true);
create policy "staff all" on visits   for all to authenticated using(true) with check(true);
create policy "own profile" on profiles for select to authenticated using(true);
