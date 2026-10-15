-- Step 10 · Investigations + Scanned Documents + purane app jaisi numbering (pehli 9 SQL files ke baad run karo)

-- A) Purane app jaisa numbering: BEH-OPD-2026-000001 / BEH-IPD-2026-000001 (sirf naye records ke liye)
create or replace function public.set_visit_no() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; y int; yr text; begin perform pg_advisory_xact_lock(hashtext('visit_no'));
  yr:=to_char(new.visit_date,'YYYY');
  select count(*) into n from visits where kind=new.kind and visit_date=new.visit_date;
  select coalesce(max(right(visit_no,6)::int),0) into y from visits where visit_no like 'BEH-'||new.kind||'-'||yr||'-%';
  new.visit_no:='BEH-'||new.kind||'-'||yr||'-'||lpad((y+1)::text,6,'0');
  if new.kind='OPD' then new.token:=n+1; end if; return new; end $$;
create or replace function public.admission_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare n int; m boolean; yr text:=to_char(current_date,'YYYY'); begin
  if tg_op='INSERT' then perform pg_advisory_xact_lock(hashtext('adm_no'));
    select coalesce(max(right(adm_no,6)::int),0) into n from admissions where adm_no like 'BEH-IPD-'||yr||'-%';
    new.adm_no:='BEH-IPD-'||yr||'-'||lpad((n+1)::text,6,'0'); end if;
  if new.status='Admitted' then
    if new.bed_id is null then raise exception 'Admit karne ke liye bed zaruri hai'; end if;
    if new.admitted_at is null then new.admitted_at:=now(); end if;
    select multi into m from beds where id=new.bed_id;
    if not m and exists(select 1 from admissions where bed_id=new.bed_id and status='Admitted' and id<>new.id) then
      raise exception 'Ye bed pehle se occupied hai'; end if; end if;
  return new; end $$;

-- B) Master list (purane app ki Procedures.xlsx wali: 13 OPD investigations + 87 IPD procedures)
create table catalog_items(id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('opd_investigation','ipd_procedure')),
  name text not null, category text, active boolean not null default true, unique(kind,name));
insert into catalog_items(kind,name,category) values
('opd_investigation','Refraction with auto refraction - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Indirect Ophthalmoscopy (Fundoscopy) - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Ultrasound A- Scan/optical biometry[lenstar, IOL master] - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Fundus Photo Test /disc photo for glaucoma- Both Eyes','Ophthalmology Investigation'),
('opd_investigation','OCT (Optical Coherence Tomography) /Ocular OCT Angiography - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Non Contact tonometry (NCT) - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','IOP measurement with applanation tonometry - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Diurnal variation of IOP - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','90 D lens examination/Three mirror examination for retina - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Gonioscopy- Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Neostigmine test - Both Eyes','Ophthalmology Investigation'),
('opd_investigation','Schirmer Test','Ophthalmology Investigation'),
('opd_investigation','Vitreous biopsy per eye','Ophthalmology Biopsy'),
('ipd_procedure','Subconjunctival/sub-tenon-s injections in one eye','Ophthalmology Procedure'),
('ipd_procedure','Subconjunctival/sub-tenon-s injections in both eyes','Ophthalmology Procedure'),
('ipd_procedure','Pterygium surgery with auto conjunctival graft per eye','Ophthalmology Procedure'),
('ipd_procedure','Conjunctival wound repair or exploration following blunt trauma per eye','Ophthalmology Procedure'),
('ipd_procedure','Removal of corneal foreign body','Ophthalmology Procedure'),
('ipd_procedure','Cauterization of ulcer/subconjunctival injection in one eye','Ophthalmology Procedure'),
('ipd_procedure','Cauterization of ulcer/subconjunctival injection in both eyes','Ophthalmology Procedure'),
('ipd_procedure','Bandage contact lenses for corneal perforation/PED per eye','Ophthalmology Procedure'),
('ipd_procedure','Keratoconus correction with therapeutic contact lenses - Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','Ultraviolet (UV) radiation for cross-linking for keratoconus /C3R/KXL - Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','EDTA for band shaped keratopathy - Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','Re-suturing (Primary suturing) of corneal wound per eye','Ophthalmology Procedure'),
('ipd_procedure','Bleb repair with conjunctival autograft per eye','Ophthalmology Procedure'),
('ipd_procedure','Bleb compression sutures per eye','Ophthalmology Procedure'),
('ipd_procedure','Bleb needling with MMC/5-FU per eye','Ophthalmology Procedure'),
('ipd_procedure','Probing and Syringing of lacrimal sac- in one eye','Ophthalmology Procedure'),
('ipd_procedure','Probing and Syringing of lacrimal sac- in both eye','Ophthalmology Procedure'),
('ipd_procedure','Canaliculoplasty per eye','Ophthalmology Procedure'),
('ipd_procedure','Punctal plugs for dry eyes - Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','Chalazion incision and curettage in one eye','Ophthalmology Procedure'),
('ipd_procedure','Chalazion incision and curettage in both eyes','Ophthalmology Procedure'),
('ipd_procedure','Ptosis surgery with Fasanella-Servat procedure /Ptosis surgery with LPS resection one lid Ptosis surgery with Sling surgery one lid','Ophthalmology Procedure'),
('ipd_procedure','Ectropion surgery- one lid','Ophthalmology Procedure'),
('ipd_procedure','Ectropion surgery- both lids','Ophthalmology Procedure'),
('ipd_procedure','Entropion surgery- one lid','Ophthalmology Procedure'),
('ipd_procedure','Entropion surgery- both lids','Ophthalmology Procedure'),
('ipd_procedure','Tarsorrhaphy- Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','Suturing of lid lacerations- Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','Lid retraction repair per eye','Ophthalmology Procedure'),
('ipd_procedure','Concretions removal- Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','Bucket handle procedure for lid tumours per eye (for non-malignant conditions)','Ophthalmology Procedure'),
('ipd_procedure','Eyelid reconstruction with flap one eye','Ophthalmology Procedure'),
('ipd_procedure','Eyelid reconstruction with flap both eyes','Ophthalmology Procedure'),
('ipd_procedure','Cheek rotation flap for lid tumours per eye (for non-malignant conditions)','Ophthalmology Procedure'),
('ipd_procedure','Enucleation per eye(for non-malignant conditions)','Ophthalmology Procedure'),
('ipd_procedure','Enucleation with orbital implants and artificial (Cost of implants included) per eye','Ophthalmology Procedure'),
('ipd_procedure','Evisceration per eye','Ophthalmology Procedure'),
('ipd_procedure','Evisceration with orbital implants and artificial (Cost of implants included) prosthesis per eye','Ophthalmology Procedure'),
('ipd_procedure','Retinal laser procedures -green laser for PRP,retinal tears, ROP,endolaser per eye','Ophthalmology Procedure'),
('ipd_procedure','Squint correction for one eye','Ophthalmology Procedure'),
('ipd_procedure','Squint correction for both eyes','Ophthalmology Procedure'),
('ipd_procedure','Trabeculectomy with Trabeculotomy- Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','Microincisional trabeculectomy(MIT) per eye','Ophthalmology Procedure'),
('ipd_procedure','Surgical posterior capsulotomy one eye','Ophthalmology Procedure'),
('ipd_procedure','Goniotomy per eye','Ophthalmology Procedure'),
('ipd_procedure','Glaucoma surgery with Glaucoma valves (Cost of Valve extra) per eye','Ophthalmology Procedure'),
('ipd_procedure','Cost of the Glaucoma valve/Glaucoma Ahmed valve per eye','Ophthalmology Procedure'),
('ipd_procedure','AC wash per eye','Ophthalmology Procedure'),
('ipd_procedure','YAG Laser iridotomy / Hyaloidotomy/Laser suture lysis post trabeculectomy per eye','Ophthalmology Procedure'),
('ipd_procedure','YAG Laser capsulotomy per eye','Ophthalmology Procedure'),
('ipd_procedure','PTK- Phototherapeutic keratectomy /PRK for keratoconus per eye','Ophthalmology Procedure'),
('ipd_procedure','Anterior vitrectomy per eye','Ophthalmology Procedure'),
('ipd_procedure','Membranectomy one eye','Ophthalmology Procedure'),
('ipd_procedure','Membranectomy both eyes','Ophthalmology Procedure'),
('ipd_procedure','Intravitreal injections of antibiotics excluding the cost of the antibiotic per eye','Ophthalmology Procedure'),
('ipd_procedure','Intravitreal Injection of drugs (Ranibizumab/ Aflibercept etc) excluding the cost of the drug per eye','Ophthalmology Procedure'),
('ipd_procedure','Intravitreal Insertion of Drug Implant excluding cost of the Drug Implant (Ozurdex,...etc)  per eye','Ophthalmology Procedure'),
('ipd_procedure','Extracapsular cataract extraction (ECCE) with IOL excluding the cost of IOL per eye','Ophthalmology Procedure'),
('ipd_procedure','Small Incision Cataract Surgery (SICS) with IOL excluding the cost of IOL per eye','Ophthalmology Procedure'),
('ipd_procedure','Phaco with foldable IOL (silicone and acrylic)/PMMA IOL / MICS surgery excluding the cost of IOL per eye','Ophthalmology Procedure'),
('ipd_procedure','Pars plana lensectomy with/without IOL excluding the cost of IOL per eye','Ophthalmology Procedure'),
('ipd_procedure','Secondary IOL implantation- AC IOL PC IOL or scleral fixated IOL  excluding the cost of IOL per eye','Ophthalmology Procedure'),
('ipd_procedure','Cataract extraction with IOL with capsular tension rings (Cionni-s ring)(cost of the ring included) excluding the cost of IOL per eye','Ophthalmology Procedure'),
('ipd_procedure','Paediatric cataract surgery +parsplana capsulotomy + anterior vitrectomy excluding the cost of IOL - one eye','Ophthalmology Procedure'),
('ipd_procedure','Paediatric cataract surgery +parsplana capsulotomy + anterior vitrectomy  excluding the cost of IOL - Both Eyes','Ophthalmology Procedure'),
('ipd_procedure','IOL exchange [excluding IOL cost] per eye','Ophthalmology Procedure'),
('ipd_procedure','IOL reposition per eye','Ophthalmology Procedure'),
('ipd_procedure','IOL explantation per eye','Ophthalmology Procedure'),
('ipd_procedure','Iridodialysis repair or pupillary reconstruction /Cyclodialysis repair per eye','Ophthalmology Procedure'),
('ipd_procedure','Iris cyst removal /synechiolysis/surgical iridectomy per eye','Ophthalmology Procedure'),
('ipd_procedure','Lid Abscess incision and Drainage per eye','Ophthalmology Procedure'),
('ipd_procedure','Orbital Abscess incision and Drainage per eye','Ophthalmology Procedure'),
('ipd_procedure','Excision Biopsy of lid, conjunctiva, cornea per eye','Ophthalmology Procedure'),
('ipd_procedure','Paracentesis (eye) per eye','Ophthalmology Procedure'),
('ipd_procedure','Scleral graft for scleral melting or perforation per eye','Ophthalmology Procedure'),
('ipd_procedure','Amniotic membrane grafting /symblepharon release with AMG per eye','Ophthalmology Procedure'),
('ipd_procedure','Intraocular foreign body removal per eye','Ophthalmology Procedure'),
('ipd_procedure','Perforating injury repair (eye) per eye','Ophthalmology Procedure'),
('ipd_procedure','Globe exploration per eye','Ophthalmology Procedure'),
('ipd_procedure','Scleral Fixation Tissue glue /fibrin glue per eye','Ophthalmology Procedure'),
('ipd_procedure','Methylprednisolone Injection IV Infusion per day Excluding the cost of the drug','Ophthalmology Procedure'),
('ipd_procedure','Simple limbal stem cell transplant SLET per eye','Ophthalmology Procedure'),
('ipd_procedure','Mucous membrane grafting MMG one eyelid','Ophthalmology Procedure'),
('ipd_procedure','Mucous membrane grafting MMG two eyelids','Ophthalmology Procedure'),
('ipd_procedure','iStent Inject per eye including the cost of consumables and implant','Ophthalmology Procedure'),
('ipd_procedure','Orthoptic exercises per session','Ophthalmology Physiotherapy'),
('ipd_procedure','Pleoptic exercises per session','Ophthalmology Physiotherapy');

-- C) Investigation orders (bill ke saath)
create table investigations(id uuid primary key default gen_random_uuid(), patient_id uuid not null references patients on delete cascade,
  context text not null check (context in ('OPD','IPD')), admission_id uuid references admissions on delete set null,
  name text not null, category text, charge numeric not null default 0, bill_id uuid references bills on delete set null,
  status text not null default 'Ordered' check (status in ('Ordered','Done')), result text, done_at timestamptz, done_by uuid,
  created_by uuid default auth.uid(), created_at timestamptz default now());
create index on investigations(patient_id); create index on investigations(status);

create function public.order_investigations(p_patient uuid,p_ctx text,p_adm uuid,p_items jsonb,p_discount numeric,p_authority text,p_paid numeric,p_mode text)
returns uuid language plpgsql security definer set search_path=public as $$
declare it jsonb; sub numeric:=0; d numeric:=coalesce(p_discount,0); c numeric; b uuid; begin
  if public.my_role() not in ('Reception','Billing','Admin','Super Admin') then raise exception 'Aapka role investigation bill nahi bana sakta'; end if;
  if p_ctx not in ('OPD','IPD') then raise exception 'OPD ya IPD chuno'; end if;
  if p_ctx='IPD' and (p_adm is null or not exists(select 1 from admissions where id=p_adm and patient_id=p_patient and status in ('Admitted','Discharged')))
    then raise exception 'IPD ke liye is patient ka admission chuno'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then raise exception 'Kam se kam ek item chuno'; end if;
  for it in select value from jsonb_array_elements(p_items) loop
    if coalesce(trim(it->>'name'),'')='' then raise exception 'Item ka naam zaruri hai'; end if;
    c:=(it->>'charge')::numeric; if c is null or c<0 then raise exception 'Har item ka charge daalo'; end if; sub:=sub+c; end loop;
  if d<0 or d>sub then raise exception 'Discount galat hai'; end if;
  if d>0 and coalesce(trim(p_authority),'')='' then raise exception 'Discount ke liye authority ka naam zaruri hai'; end if;
  if coalesce(p_paid,0)>sub-d then raise exception 'Paid amount total se zyada hai'; end if;
  insert into bills(patient_id,kind,items,subtotal,discount,total,mode,discount_authority)
    values(p_patient,case p_ctx when 'OPD' then 'Investigation' else 'IPD Procedure' end,
      (select jsonb_agg(jsonb_build_object('d',x->>'name','q',1,'r',(x->>'charge')::numeric)) from jsonb_array_elements(p_items) x),
      sub,d,sub-d,coalesce(p_mode,'Cash'),nullif(trim(p_authority),'')) returning id into b;
  insert into investigations(patient_id,context,admission_id,name,category,charge,bill_id)
    select p_patient,p_ctx,case when p_ctx='IPD' then p_adm end,x->>'name',x->>'category',(x->>'charge')::numeric,b from jsonb_array_elements(p_items) x;
  if coalesce(p_paid,0)>0 then insert into payments(bill_id,amount,mode) values(b,p_paid,coalesce(p_mode,'Cash')); end if;
  return b; end $$;

-- D) Scanned documents (private storage)
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('patient-docs','patient-docs',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
create policy "docs read" on storage.objects for select to authenticated using(bucket_id='patient-docs' and public.is_active());
create policy "docs upload" on storage.objects for insert to authenticated with check(bucket_id='patient-docs' and public.my_role() in ('Reception','Doctor','Billing','Admin','Super Admin'));
create table documents(id uuid primary key default gen_random_uuid(), patient_id uuid not null references patients on delete cascade,
  doc_type text not null, name text not null, notes text, file_path text not null, file_name text, mime text, size int,
  uploaded_by uuid default auth.uid(), created_at timestamptz default now(), deleted_at timestamptz, deleted_reason text, deleted_by uuid);
create index on documents(patient_id);

-- E) RLS + audit
alter table catalog_items enable row level security; alter table investigations enable row level security; alter table documents enable row level security;
create policy "read" on catalog_items for select to authenticated using(true);
create policy "admin add" on catalog_items for insert to authenticated with check(public.is_admin());
create policy "admin edit" on catalog_items for update to authenticated using(public.is_admin());
create policy "read" on investigations for select to authenticated using(true);
create policy "update result" on investigations for update to authenticated using(public.my_role() in ('Doctor','Reception','Admin','Super Admin'));
create policy "read" on documents for select to authenticated using(true);
create policy "upload" on documents for insert to authenticated with check(public.my_role() in ('Reception','Doctor','Billing','Admin','Super Admin'));
create policy "admin remove" on documents for update to authenticated using(public.is_admin());
do $$ declare t text; begin
  foreach t in array array['catalog_items','investigations','documents'] loop
    execute format('create policy "active only" on %I as restrictive for all to authenticated using (public.is_active()) with check (public.is_active())',t);
    execute format('create trigger trg_audit after insert or update or delete on %I for each row execute function public.audit_trigger()',t);
  end loop; end $$;
