-- Step 6 · Discharge Card + India timezone fix (run after the first 5 SQL files)
alter database postgres set timezone to 'Asia/Kolkata';   -- keeps dates correct between midnight and 5:30 AM IST
create table discharge_summaries(id uuid primary key default gen_random_uuid(), admission_id uuid not null unique references admissions on delete cascade,
  patient_id uuid not null references patients on delete cascade, doctor text, data jsonb not null default '{}',
  created_by uuid default auth.uid(), updated_at timestamptz default now());
alter table discharge_summaries enable row level security;
create policy "read" on discharge_summaries for select to authenticated using(true);
create policy "doctor add" on discharge_summaries for insert to authenticated with check(public.my_role() in ('Doctor','Admin','Super Admin'));
create policy "doctor edit" on discharge_summaries for update to authenticated using(public.my_role() in ('Doctor','Admin','Super Admin'));
create policy "del admin" on discharge_summaries for delete to authenticated using(public.is_admin());
