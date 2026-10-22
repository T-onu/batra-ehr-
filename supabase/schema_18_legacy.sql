-- Step 18 · keep the numbers of the old software so old receipts and records can still be found after the data migration.
alter table patients add column if not exists legacy_uhid text;
alter table visits add column if not exists legacy_no text;
alter table admissions add column if not exists legacy_no text;
alter table bills add column if not exists legacy_ref text;
create unique index if not exists patients_legacy_uhid_key on patients(legacy_uhid) where legacy_uhid is not null;
create unique index if not exists visits_legacy_no_key on visits(legacy_no) where legacy_no is not null;
create unique index if not exists admissions_legacy_no_key on admissions(legacy_no) where legacy_no is not null;
create unique index if not exists bills_legacy_ref_key on bills(legacy_ref) where legacy_ref is not null;
