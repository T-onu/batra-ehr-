-- Step 3 · Clinical Exam (schema.sql, schema_02 ke baad run karo)
create or replace function my_role() returns text language sql security definer stable as $$ select role from profiles where id=auth.uid() $$;
create table exams(id uuid primary key default gen_random_uuid(), visit_id uuid not null unique references visits on delete cascade,
  patient_id uuid not null references patients on delete cascade, doctor text, data jsonb not null default '{}',
  created_by uuid default auth.uid(), created_at timestamptz default now(), updated_at timestamptz default now());
create index on exams(patient_id);
alter table exams enable row level security;
create policy "read" on exams for select to authenticated using(true);
create policy "doctor write" on exams for insert to authenticated with check(my_role() in ('Doctor','Admin','Super Admin'));
create policy "doctor edit" on exams for update to authenticated using(my_role() in ('Doctor','Admin','Super Admin'));
create policy "admin del" on exams for delete to authenticated using(is_admin());
create policy "doctor visit status" on visits for update to authenticated using(true);
