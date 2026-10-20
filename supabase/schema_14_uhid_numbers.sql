-- Step 14 · Patient numbers (UHID) without a prefix: 000001, 000002, ... (run after schema_13)
alter table patients alter column uhid set default (lpad(nextval('uhid_seq')::text,6,'0'));
-- existing patients are renumbered in order of registration (temporary names first so numbers never collide)
update patients set uhid='TMP-'||id::text;
with r as (select id,row_number() over(order by created_at,id) n from patients) update patients p set uhid=lpad(r.n::text,6,'0') from r where p.id=r.id;
select setval('uhid_seq',greatest((select count(*) from patients),1),(select count(*)>0 from patients));
