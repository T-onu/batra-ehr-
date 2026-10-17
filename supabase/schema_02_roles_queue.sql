-- Step 2 · roles, appointments, OPD queue (run after schema.sql)
create or replace function is_admin() returns boolean language sql security definer stable as $$
  select exists(select 1 from profiles where id=auth.uid() and role in ('Super Admin','Admin')) $$;

alter table visits add column status text not null default 'Waiting' check (status in ('Waiting','In Exam','Done','Cancelled'));
alter table visits add column token int;

create or replace function set_visit_no() returns trigger language plpgsql as $$
declare n int;
begin perform pg_advisory_xact_lock(hashtext('visit_no'));
  select count(*) into n from visits where kind=new.kind and visit_date=new.visit_date;
  new.visit_no := new.kind||'-'||to_char(new.visit_date,'YYMMDD')||'-'||lpad((n+1)::text,3,'0');
  if new.kind='OPD' then new.token := n+1; end if;
  return new; end $$;

create table appointments(id uuid primary key default gen_random_uuid(), patient_id uuid references patients on delete set null,
  name text not null, phone text, appt_date date not null default current_date, appt_time time, consultant text, reason text,
  status text not null default 'Booked' check (status in ('Booked','Arrived','Cancelled','No-show')),
  created_by uuid default auth.uid(), created_at timestamptz default now());
create index on appointments(appt_date);
alter table appointments enable row level security;
create policy "staff all" on appointments for all to authenticated using(true) with check(true);

-- only admins can delete; only admins can edit profiles
drop policy "staff all" on patients;
create policy "read" on patients for select to authenticated using(true);
create policy "add" on patients for insert to authenticated with check(true);
create policy "edit" on patients for update to authenticated using(true);
create policy "del admin" on patients for delete to authenticated using(is_admin());
create policy "admin manage" on profiles for all to authenticated using(is_admin()) with check(is_admin());

-- live updates (replaces the old LAN sync)
alter publication supabase_realtime add table visits, appointments;
