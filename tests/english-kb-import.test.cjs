const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '../supabase/migrations/202609280001_english_kb_imports.sql'),
  'utf8',
);
const library = fs.readFileSync(
  path.join(__dirname, '../tools/english-bulk-library.js'),
  'utf8',
);

test('English KB migration keeps reviewed imports private and reversible', () => {
  assert.match(migration, /create table if not exists public\.english_kb_entries/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.english_kb_entries from public, anon, authenticated/);
  assert.match(migration, /toolbox_verify_admin/);
  assert.match(migration, /reviewedAt/);
  assert.match(migration, /source_sha256 text not null unique/);
  assert.match(migration, /english_kb_import_rollback/);
  assert.match(migration, /on delete cascade/);
  assert.match(migration, /english_kb_entries_no_app_paths/);
  assert.match(migration, /unterrichtsassistent/);
  assert.doesNotMatch(migration, /grant execute[^;]+to anon/);
  assert.match(migration, /revoke all on function[^;]+from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant execute[^;]+to authenticated/);
});

test('English bulk library remains local while the cloud archive is private', () => {
  assert.match(library, /indexedDB\.open/);
  assert.doesNotMatch(library, /english_kb_query/);
  assert.doesNotMatch(library, /supabase\.co/);
  assert.doesNotMatch(library, /service_role/);
});
