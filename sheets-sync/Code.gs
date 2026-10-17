/**
 * Batra Eye Hospital EHR -> Google Sheets (one-way, read-only copy)
 *
 * The database stays the single source of truth. This script logs in as a read-only
 * "Sync" user, copies the tables below into sheets every 10 minutes, and (optionally)
 * saves an .xlsx copy to a Drive folder. Editing the sheet never changes the EHR.
 *
 * Setup: see SETUP.md. Required Script Properties:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_EMAIL, SYNC_PASSWORD
 * Optional: XLSX_FOLDER_ID (Drive folder for the .xlsx copy), HIDE_COLUMNS (comma list, e.g. phone,address)
 */
const TABLES = [
  { sheet: 'Patients',       table: 'patients',       select: '*' },
  { sheet: 'Visits',         table: 'visits',         select: '*,patients(name,uhid)' },
  { sheet: 'Bills',          table: 'bills',          select: '*,patients(name,uhid)' },
  { sheet: 'Payments',       table: 'payments',       select: '*,bills(bill_no)' },
  { sheet: 'Admissions',     table: 'admissions',     select: '*,patients(name,uhid),beds(bed_no)' },
  { sheet: 'Exams',          table: 'exams',          select: 'id,visit_id,patient_id,doctor,created_at,diagnosis:data->>diagnosis,treatment:data->>treatment,followup:data->>followup,patients(name,uhid)' },
  { sheet: 'Investigations', table: 'investigations', select: '*,patients(name,uhid)' },
  { sheet: 'Appointments',   table: 'appointments',   select: '*' },
  { sheet: 'Stock',          table: 'stock_items',    select: '*' },
  { sheet: 'Credit notes',   table: 'credit_notes',   select: '*,patients(name,uhid)' },
  { sheet: 'Documents info', table: 'documents',      select: 'id,patient_id,doc_type,name,notes,file_name,created_at,deleted_at,patients(name,uhid)' },
];

function prop_(k, required) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (required && !v) throw new Error('Missing script property: ' + k);
  return v;
}

function login_() {
  const res = UrlFetchApp.fetch(prop_('SUPABASE_URL', true) + '/auth/v1/token?grant_type=password', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: prop_('SUPABASE_ANON_KEY', true) },
    payload: JSON.stringify({ email: prop_('SYNC_EMAIL', true), password: prop_('SYNC_PASSWORD', true) }),
  });
  if (res.getResponseCode() !== 200) throw new Error('Sync login failed: ' + res.getContentText());
  return JSON.parse(res.getContentText()).access_token;
}

function fetchAll_(token, t) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const url = prop_('SUPABASE_URL', true) + '/rest/v1/' + t.table + '?select=' + encodeURIComponent(t.select) +
      '&order=created_at.asc,id.asc&limit=1000&offset=' + offset;
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { apikey: prop_('SUPABASE_ANON_KEY', true), Authorization: 'Bearer ' + token } });
    if (res.getResponseCode() !== 200) throw new Error(t.table + ': ' + res.getContentText());
    const page = JSON.parse(res.getContentText());
    rows.push.apply(rows, page);
    if (page.length < 1000) return rows;
  }
}

function flatten_(o, prefix, out) {
  Object.keys(o).forEach(function (k) {
    const v = o[k], key = prefix ? prefix + '.' + k : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flatten_(v, key, out);
    else out[key] = (v === null || v === undefined) ? '' : (typeof v === 'object' ? JSON.stringify(v) : v);
  });
  return out;
}

function writeSheet_(name, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const hide = (prop_('HIDE_COLUMNS') || '').split(',').map(function (s) { return s.trim(); }).filter(String);
  const flat = rows.map(function (r) { return flatten_(r, '', {}); });
  const header = [];
  flat.forEach(function (r) { Object.keys(r).forEach(function (k) { if (header.indexOf(k) < 0 && hide.indexOf(k) < 0) header.push(k); }); });
  sh.clearContents();
  if (!header.length) { sh.getRange(1, 1).setValue('(no rows yet)'); return 0; }
  const values = [header].concat(flat.map(function (r) { return header.map(function (h) { return r[h] === undefined ? '' : r[h]; }); }));
  for (let i = 0; i < values.length; i += 5000) {
    const chunk = values.slice(i, i + 5000);
    sh.getRange(i + 1, 1, chunk.length, header.length).setValues(chunk);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
  return rows.length;
}

function syncAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;           // another run is still going
  try {
    const token = login_(), status = [['Sheet', 'Rows', 'Result', 'Time']];
    TABLES.forEach(function (t) {
      try { status.push([t.sheet, writeSheet_(t.sheet, fetchAll_(token, t)), 'OK', new Date()]); }
      catch (e) { status.push([t.sheet, '', 'ERROR: ' + String(e).slice(0, 300), new Date()]); }
    });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const st = ss.getSheetByName('_Sync status') || ss.insertSheet('_Sync status');
    st.clearContents(); st.getRange(1, 1, status.length, 4).setValues(status);
    saveExcelCopy_();
  } finally { lock.releaseLock(); }
}

function saveExcelCopy_() {
  const folderId = prop_('XLSX_FOLDER_ID');
  if (!folderId) return;
  const id = SpreadsheetApp.getActiveSpreadsheet().getId();
  const blob = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
    { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName('Batra EHR data.xlsx');
  const folder = DriveApp.getFolderById(folderId), old = folder.getFilesByName('Batra EHR data.xlsx');
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(blob);
}

/** Run once: checks the settings, does the first sync and schedules a sync every 10 minutes. */
function setup() {
  ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SYNC_EMAIL', 'SYNC_PASSWORD'].forEach(function (k) { prop_(k, true); });
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncAll') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(10).create();
  syncAll();
}
