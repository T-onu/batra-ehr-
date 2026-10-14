-- Step 8 · Staff management + Audit log (pehli 7 SQL files ke baad run karo)
alter table profiles add column email text, add column active boolean not null default true;
insert into profiles(id,name) select id,email from auth.users on conflict do nothing;
update profiles p set email=u.email from auth.users u where u.id=p.id;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,name,email) values(new.id,coalesce(new.raw_user_meta_data->>'name',new.email),new.email) on conflict do nothing; return new; end $$;

create or replace function public.my_role() returns text language sql security definer stable set search_path=public as $$ select role from profiles where id=auth.uid() and active $$;
create or replace function public.is_admin() returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from profiles where id=auth.uid() and active and role in ('Super Admin','Admin')) $$;
create or replace function public.is_active() returns boolean language sql security definer stable set search_path=public as $$
  select coalesce((select active from profiles where id=auth.uid()),false) $$;

-- disabled / profile-less user ko koi bhi table nahi dikhegi (profiles chhodkar)
do $$ declare t text; begin
  foreach t in array array['patients','visits','appointments','exams','bills','payments','beds','admissions','discharge_summaries'] loop
    execute format('create policy "active only" on %I as restrictive for all to authenticated using (public.is_active()) with check (public.is_active())',t);
  end loop; end $$;

create function public.profile_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or tg_op<>'UPDATE' then return new; end if;
  if old.role='Super Admin' and (new.role<>'Super Admin' or not new.active)
     and not exists(select 1 from profiles where role='Super Admin' and active and id<>old.id)
  then raise exception 'Aakhri Super Admin ko hata ya disable nahi kar sakte'; end if;
  if (new.role='Super Admin' or old.role='Super Admin') and (new.role is distinct from old.role or new.active is distinct from old.active)
     and public.my_role() is distinct from 'Super Admin' then raise exception 'Sirf Super Admin ye badlav kar sakta hai'; end if;
  if new.id=auth.uid() and (new.role is distinct from old.role or new.active is distinct from old.active)
  then raise exception 'Apna role ya status khud nahi badal sakte'; end if;
  return new; end $$;
create trigger trg_profile_guard before update on profiles for each row execute function public.profile_guard();

create table audit_log(id bigserial primary key, at timestamptz not null default now(), user_id uuid, user_email text,
  action text not null, table_name text not null, record_id text, changes jsonb);
create index on audit_log(at desc); create index on audit_log(table_name);
alter table audit_log enable row level security;
create policy "admin read" on audit_log for select to authenticated using(public.is_admin());

create function public.audit_trigger() returns trigger language plpgsql security definer set search_path=public as $$
declare o jsonb; n jsonb; d jsonb; rid text; begin
  if tg_op='DELETE' then o:=to_jsonb(old); d:=o; rid:=old.id::text;
  elsif tg_op='INSERT' then n:=to_jsonb(new); d:=n; rid:=new.id::text;
  else o:=to_jsonb(old); n:=to_jsonb(new); rid:=new.id::text;
    select coalesce(jsonb_object_agg(key,jsonb_build_object('from',o->key,'to',value)),'{}'::jsonb) into d from jsonb_each(n) where o->key is distinct from value;
    if d='{}'::jsonb then return new; end if; end if;
  insert into audit_log(user_id,user_email,action,table_name,record_id,changes) values(auth.uid(),(select email from profiles where id=auth.uid()),tg_op,tg_table_name,rid,d);
  if tg_op='DELETE' then return old; end if; return new; end $$;
do $$ declare t text; begin
  foreach t in array array['patients','visits','appointments','exams','bills','payments','beds','admissions','discharge_summaries','profiles'] loop
    execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function public.audit_trigger()',t);
  end loop; end $$;
