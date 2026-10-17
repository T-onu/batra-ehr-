-- Step 7 · bill cancel + reports (run after the first 6 SQL files)
alter table bills add column status text not null default 'Active' check (status in ('Active','Cancelled')),
  add column cancel_reason text, add column cancelled_at timestamptz, add column cancelled_by uuid;
create policy "cancel admin" on bills for update to authenticated using(public.is_admin());
create index on payments(created_at);
create or replace function public.apply_payment() returns trigger language plpgsql security definer set search_path=public as $$
declare s text; t numeric; p numeric; begin
  select status,total,paid into s,t,p from bills where id=new.bill_id;
  if s='Cancelled' then raise exception 'Payments cannot be taken on a cancelled bill'; end if;
  if p+new.amount>t then raise exception 'Payment exceeds the bill balance'; end if;
  update bills set paid=paid+new.amount where id=new.bill_id; return new; end $$;
