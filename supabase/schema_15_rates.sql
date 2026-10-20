-- Step 15 · Charges (rates) for investigations and procedures (run after schema_14)
-- A charge is filled in automatically when the item is selected. Admins edit or import rates in Investigations → Master list.
alter table catalog_items add column rate numeric check (rate is null or rate>=0);
