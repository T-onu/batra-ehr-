# Google Sheets / Excel sync (one-way, read-only)

The EHR database stays the single source of truth. A small Google Apps Script copies the data into a Google Sheet every 10 minutes.
Editing the sheet never changes the EHR.

## 1. Create a read-only "Sync" user
1. Supabase → Authentication → Users → Add user. Use an email like `sheets-sync@yourdomain` and a long random password. Tick **Auto Confirm**.
2. In the EHR open **Staff & Roles** and set that user's role to **Sync**. This role can read data but cannot change anything (enforced by the database).
3. Make sure `supabase/schema_12_tighten_access.sql` has been run.

## 2. Create the sheet and script
1. Create a new Google Sheet in the hospital's Google account (turn on 2-Step Verification for that account).
2. Extensions → Apps Script. Delete the sample code and paste the whole of `Code.gs`.
3. Project Settings (gear icon) → Script properties → add:
   - `SUPABASE_URL` = your project URL (Supabase → Project Settings → API)
   - `SUPABASE_ANON_KEY` = the **anon / public** key (never the service_role key)
   - `SYNC_EMAIL` and `SYNC_PASSWORD` = the Sync user from step 1
   - optional `HIDE_COLUMNS` = e.g. `phone,address` to keep those columns out of the sheet
4. In the editor choose the function **setup** and click Run. Approve the permissions. It does the first sync and schedules one every 10 minutes.
5. Open the `_Sync status` tab to see each table's row count and any error.

## 3. Excel file on the hospital PC (optional)
1. Create a folder in Google Drive, open it and copy the long ID at the end of its URL.
2. Add the script property `XLSX_FOLDER_ID` = that ID.
3. Install **Google Drive for desktop** on the hospital PC and make the folder available offline.
   `Batra EHR data.xlsx` will then be refreshed on the PC about every 10 minutes.

## Privacy
The sheet is a full copy of patient data. Keep it private to a few people, never share it as "anyone with the link",
and use `HIDE_COLUMNS` if some columns are not needed. Treat it with the same care as the EHR itself.
