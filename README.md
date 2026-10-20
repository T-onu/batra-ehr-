# Batra Eye Hospital EHR (React + Supabase + PWA)

1. `npm install`
2. In the Supabase SQL Editor run the files in `supabase/` in order: `schema.sql`, then `schema_02` ... `schema_17`.
3. Create your first user in Supabase (Authentication → Users → Add user, tick Auto Confirm) and make it a Super Admin:
   `update profiles set role='Super Admin' where id=(select id from auth.users where email='you@example.com');`
4. `cp .env.example .env` and fill in the Supabase URL and anon key.
5. `npm run dev` for development, or deploy the project to Vercel (add the same two variables in Project Settings → Environment Variables).

6. Optional: automatic Google Sheets / Excel copy, see `sheets-sync/SETUP.md`.

## Roles
Only four roles exist: **Super Admin** (everything), **Admin** (everything except Staff & Roles and Audit Log), **Doctor** (clinical tabs, OPD queue, admissions, discharge, documents) and **Reception** (dashboard, patients & OPD, appointments, OPD queue, optical, documents). Staff who had the old Billing / Pharmacy / Sync roles become Admin and Optical becomes Reception when `schema_17` runs.
