-- Step 17 · Investigation / procedure master list from the hospital's Excel sheet, and automatic procedure charge on admission.
-- The same list is used for OPD investigations / procedures and for IPD admissions. Items without a charge are priced manually.
create temp table _proc(name text,rate numeric) on commit drop;
insert into _proc(name,rate) values
('Mucous membrane grafting MMG one eyelid',null),
('Mucous membrane grafting MMG two eyelids',null),
('iStem inject per eye including the cost of consumables and implant',null),
('Orthoptic exercises per session',null),
('Pleoptic exercises per session',null),
('Green Laser (PRP (Pan Retinal Photocoagulation))',2000),
('Green laser(Barrage laser)',3500),
('Phaco with foldable IOL (silicone and acrylic) / PMMA IOL / MICS surgery including the cost of IOL per eye',null),
('Phaco with foldable IOL',null),
('Phaco with foldable IOL/MICS surgery the cost of IOL per eye',null),
('Eye lid laceration repair per eye (Minor)',1000),
('Eye lid laceration repair (Major)',6500),
('C3R',null),
('CYST',null),
('XANTHALASMA REMOVAL',null),
('SUTURE REMOVAL',300),
('PHACO WITH INJECTION',null),
('LPI LASER',3000),
('Evisceration with orbital implants and artificial (Cost of implants included) prosthesis per eye',null),
('Retinal laser procedures -green laser for PRP,retinal tears, ROP,endolaser per eye',null),
('Squint correction for one eye',null),
('Squint correction for both eyes',null),
('Trabeculectomy with Trabeculotomy- Both Eyes',null),
('Microincisional trabeculectomy(MIT) per eye',null),
('Surgical posterior capsulotomy one eye',null),
('Goniotomy per eye',null),
('Glaucoma surgery with Glaucoma valves (Cost of valve extra) per eye',null),
('Cost of the Glaucoma valve/Glaucoma Ahmd valve per eye',null),
('AC wash per eye (Minor)',null),
('AC wash per eye(Major)',null),
('YAG Laser iridotomy / Hyaloidotomy/Laser suture lysis post trabeculectomy per eye',null),
('YAG Laser capsulotomy per eye',1000),
('PTK - Phototherapeutic Keratectomy /PRK for keratoconus per eye',null),
('Anterior vitrectomy per eye',null),
('Membranectomy one eye',null),
('Membranectomy both eyes',null),
('Intravitreal injections of antibiotics excluding the cost of the antibiotic per eye',null),
('Intravitreal injection of drugs (Ranibizumab/ Aflibercept etc) excluding the cost of the drug per eye',10000),
('Intravitreal Insertion of Drug Implant excluding cost of the Drug Implant (Ozurdex...etc) per eye',null),
('Ectropion surgery- both lids',null),
('Entropion surgery- one lid',null),
('Entropion surgery- both lids',null),
('Tarsorrhaphy- Both Eyes',null),
('Suturing of lid lacerations- Both Eyes',null),
('Concretions removal- Both Eyes',null),
('Bucket handle procedure for lid tumours per eye (for non-malignant conditions)',null),
('Eyelid reconstruction with flap one eye',null),
('Eyelid reconstruction with flap both eyes',null),
('Cheek rotation flap for lid tumours per eye (for non-malignant conditions)',null),
('Enucleation per eye(for non-malignant conditions)',null),
('Enucleation with orbital implants and artificial (Cost of implants included) per eye',null),
('Evisceration per eye',null),
('Ultraviolet (UV) radiation for cross-linking for keratoconus /C3R/KXL - Both Eyes',null),
('EDTA for band shaped keratopathy - Both Eyes',null),
('Re-suturing (Primary suturing) of corneal wound per eye',null),
('Bleb repair with conjunctival autograft per eye',null),
('Bleb compression sutures per eye',null),
('Bleb needling with MMC/5-FU per eye',null),
('Probing and Syringing of lacrimal sac- in one eye',null),
('Probing and Syringing of lacrimal sac- in both eye',null),
('Canaliculoplasty',null),
('Punctal Plugs for dry eyes - Both Eyes',null),
('Chalazion incision and curettage in one eye',null),
('Chalazion incision and curettage in both eyes',null),
('Ptosis surgery with Fasanella-Servat procedure /Ptosis surgery with LPS resection one lid Ptosis surgery with Sling surgery one lid',null),
('Ectropion surgery- one lid',null),
('Lid retraction repair per eye',null),
('Pterygium surgery with auto conjunctival graft per eye',6500),
('Conjunctival wound repair exploration following blunt trauma per eye',null),
('Removal of corneal foreign body',null),
('Cauterization of ulcer/subconjunctival injection in one eye',null),
('Cauterization of ulcer/subconjunctival injection in both eyes',null),
('Bandage contact lenses for corneal perforation/PED per eye',null),
('Keratoconus correction with therapeutic contact lenses - Both Eyes',null),
('Refraction with auto refraction - Both Eyes',null),
('Indirect Ophthalmoscopy (Fundoscopy) - Both Eyes',null),
('Ultrasound A- Scan/optical biometry(lenstar IOL master) - Both Eyes',null),
('Fundus Photo Test /disc Photo for glaucoma- Both Eyes',null),
('OCT (Optical Coherence Tomography )/Ocular OCT Angiography - Both Eyes',null),
('Non Contact Tonometry (NCT) - Both Eyes',null),
('IOP measurement with applanation tonometry - Both Eyes',null),
('Diurnal variation of IOP - Both Eyes',null),
('90 D lens examination/Three mirror examination for retina - Both Eyes',null),
('Gonioscopy- Both Eyes',null),
('Neostigmine test - Both Eyes',null),
('Schirmer Test',null),
('Vitreous biopsy per eye',null),
('OCT (Optical Coherence Tomography) Macula + Fundus Photo',1200),
('OCT (Optical Coherence Tomography) DISC/RNFL',1200),
('OCT (Optical Coherence Tomography) ANGLE VIEW',null),
('Fundus Photo (Montage/Panaroma)',null),
('Corneal Thickness',null),
('Phaco with foldable IOL (Silicone and acrylic) / PMMA IOL/MICS surgery including the cost of IOL per eye',null);

insert into catalog_items(kind,name,category,rate,active)
select k.kind,p.name,case when k.kind='opd_investigation' then 'Ophthalmology Investigation' else 'Ophthalmology Procedure' end,p.rate,true
from _proc p cross join (values ('opd_investigation'),('ipd_procedure')) k(kind)
on conflict (kind,name) do update set rate=coalesce(excluded.rate,catalog_items.rate),active=true;

-- Add the admission procedure to the IPD bill automatically when its charge is listed (runs as the system, so Doctors can admit too)
create or replace function public.bill_admission_procedure() returns trigger language plpgsql security definer set search_path=public as $$
declare r numeric; b bills%rowtype; begin
  if new.status<>'Admitted' or coalesce(trim(new.procedure),'')='' then return new; end if;
  select rate into r from catalog_items where kind='ipd_procedure' and lower(name)=lower(trim(new.procedure)) and rate is not null limit 1;
  if r is null or r<=0 then return new; end if;
  select * into b from bills where admission_id=new.id and kind='IPD' and status='Active' order by created_at limit 1 for update;
  if not found then
    insert into bills(patient_id,admission_id,kind,items,subtotal,discount,total,mode) values(new.patient_id,new.id,'IPD','[]'::jsonb,0,0,0,'Cash') returning * into b; end if;
  if b.finalized_at is not null or exists(select 1 from jsonb_array_elements(b.items) x where lower(x->>'d')=lower(trim(new.procedure))) then return new; end if;
  update bills set items=items||jsonb_build_array(jsonb_build_object('d',trim(new.procedure),'q',1,'r',r,'c','Procedure')),subtotal=subtotal+r,total=total+r where id=b.id;
  return new; end $$;
drop trigger if exists trg_bill_procedure on admissions;
create trigger trg_bill_procedure after insert or update of status on admissions for each row execute function public.bill_admission_procedure();

-- Backfill: patients already admitted
update admissions set status=status where status='Admitted';
