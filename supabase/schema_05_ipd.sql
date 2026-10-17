-- Step 5 · IPD Admissions + Beds (run after the first 4 SQL files)
create table beds(id uuid primary key default gen_random_uuid(), ward text not null, bed_no text not null,
  multi boolean not null default false, active boolean not null default true, unique(ward,bed_no));
insert into beds(ward,bed_no,multi) values ('Daycare','Daycare',true);

create table admissions(id uuid primary key default gen_random_uuid(), adm_no text unique,
  patient_id uuid not null references patients on delete restrict, visit_id uuid references visits on delete set null,
  procedure text not null, side text default 'OS' check (side in ('OD','OS','OU')), surgeon text,
  bed_id uuid references beds on delete set null, preop text, category text default 'Cash', refer_no text,
  planned_date date, advance numeric default 0,
  status text not null default 'Admitted' check (status in ('Booked','Admitted','Discharged','Cancelled')),
  admitted_at timestamptz, discharged_at timestamptz, created_by uuid default auth.uid(), created_at timestamptz default now());
create index on admissions(status); create index on admissions(patient_id);

create function public.admission_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; m boolean; begin
  if tg_op='INSERT' then perform pg_advisory_xact_lock(hashtext('adm_no'));
    select count(*) into n from admissions where created_at::date=current_date;
    new.adm_no:='ADM-'||to_char(current_date,'YYMMDD')||'-'||lpad((n+1)::text,3,'0'); end if;
  if new.status='Admitted' then
    if new.bed_id is null then raise exception 'A bed is required to admit a patient'; end if;
    if new.admitted_at is null then new.admitted_at:=now(); end if;
    select multi into m from beds where id=new.bed_id;
    if not m and exists(select 1 from admissions where bed_id=new.bed_id and status='Admitted' and id<>new.id) then
      raise exception 'This bed is already occupied'; end if; end if;
  return new; end $$;
create trigger trg_adm before insert or update on admissions for each row execute function public.admission_guard();

alter table beds enable row level security; alter table admissions enable row level security;
create policy "read" on beds for select to authenticated using(true);
create policy "admin beds" on beds for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "read" on admissions for select to authenticated using(true);
create policy "add" on admissions for insert to authenticated with check(public.my_role() in ('Doctor','Reception','Billing','Admin','Super Admin'));
create policy "edit" on admissions for update to authenticated using(public.my_role() in ('Doctor','Reception','Billing','Admin','Super Admin'));
create policy "del admin" on admissions for delete to authenticated using(public.is_admin());
alter publication supabase_realtime add table admissions;
