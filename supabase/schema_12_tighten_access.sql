-- Step 12 · Tighter write access for visits, appointments and patients (run after schema_11)
-- Visits are created only by register_opd(); staff can only change a visit's status.
drop policy if exists "staff all" on visits;
drop policy if exists "doctor visit status" on visits;
create policy "read" on visits for select to authenticated using(true);
create policy "update status" on visits for update to authenticated using(public.my_role() in ('Reception','Doctor','Billing','Admin','Super Admin'));
create policy "del admin" on visits for delete to authenticated using(public.is_admin());

drop policy if exists "staff all" on appointments;
create policy "read" on appointments for select to authenticated using(true);
create policy "book" on appointments for insert to authenticated with check(public.my_role() in ('Reception','Billing','Admin','Super Admin'));
create policy "change" on appointments for update to authenticated using(public.my_role() in ('Reception','Billing','Admin','Super Admin'));
create policy "del admin" on appointments for delete to authenticated using(public.is_admin());

drop policy if exists "add" on patients;
drop policy if exists "edit" on patients;
create policy "add" on patients for insert to authenticated with check(public.my_role() in ('Reception','Billing','Admin','Super Admin'));
create policy "edit" on patients for update to authenticated using(public.my_role() in ('Reception','Billing','Doctor','Admin','Super Admin'));
