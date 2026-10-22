# Moving the old software's data (ehr-data.json) into the new system

Do this once, from your own computer. Nothing is saved until the last step.

1. In the Supabase SQL Editor run `supabase/schema_18_legacy.sql` (after schema_17).
2. In Supabase open **Connect** and copy the **Session pooler** connection string. Replace `[YOUR-PASSWORD]` with the database password. Do not share this string with anyone.
3. Put the old `ehr-data.json` in the project folder (next to `package.json`).
4. Open a terminal in the `migration` folder and run:
   ```
   npm install
   set DATABASE_URL=postgresql://...      (Windows)     or      export DATABASE_URL='postgresql://...'   (Mac / Linux)
   node import-old-data.mjs --file ../ehr-data.json --wipe-test-data
   ```
   This is a **dry run**. It removes the test data and imports everything inside a transaction, prints the checks (counts and money totals compared with the old file) and the list of things to review, then rolls everything back. The same text is saved in `migration/import-report.txt`.
5. When every line says OK, run the same command again with `--commit` added. It asks you to type `DELETE TEST DATA`, then saves everything.

What is kept: patients, OPD registrations, OPD investigations, IPD admissions, final bills, advances, refunds and all receipts.
What is not imported: staff PINs, Aadhaar numbers, the old audit log and the old queue. Create staff users in Supabase instead.

New numbers: UHID keeps the old digits (BEH-2026-1693 becomes 001693; the old number stays searchable). OPD, IPD, receipt and bill numbers are renumbered in date order (OPD000001, IPD000001, RV000001, RCP-YYMMDD-001); the old OPD / IPD number is stored and can be typed in the search boxes.
