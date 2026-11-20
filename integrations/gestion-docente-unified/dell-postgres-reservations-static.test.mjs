import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=readFileSync(new URL('./DELL_POSTGRES_GESTION_DRAFT.sql',import.meta.url),'utf8');
const sql=readFileSync(new URL('./DELL_POSTGRES_RESERVAS_STAGE.sql',import.meta.url),'utf8');
const code=sql.replace(/--[^\n]*/g,'');
test('two migrations remain review-only and do not create official school gradebook',()=>{
 assert.match(base,/DO NOT APPLY/);assert.match(sql,/NEVER RUN ON LIVE/);
 assert.doesNotMatch(base+sql,/create\s+table\s+gestion\.(?:grades|attendance|enrollment|matriculas)\s*\(/i);
});
test('quota table maintains invariant used + reserved <= hard_limit',()=>{
 assert.match(code,/create table gestion\.storage_quotas/i);
 assert.match(code,/CHECK\(used_bytes\+reserved_bytes<=hard_limit_bytes\)/);
 assert.match(code,/CHECK\(used_bytes>=0\)/);
 assert.match(code,/CHECK\(reserved_bytes>=0\)/);
});
test('reservation is unique by tenant, owner and idempotency key',()=>{
 assert.match(code,/UNIQUE\(school_id,owner_id,idempotency_key\)/);
 assert.match(code,/CHECK\(length\(idempotency_key\) BETWEEN 16 AND 100/);
});
test('all reservation parent foreign keys are tenant scoped',()=>{
 assert.match(code,/FOREIGN KEY\(school_id,owner_id\) REFERENCES gestion\.memberships\(school_id,user_id\)/);
 assert.match(code,/FOREIGN KEY\(school_id,folder_id\) REFERENCES gestion\.folders\(school_id,id\)/);
 assert.match(code,/FOREIGN KEY\(school_id,file_id\) REFERENCES gestion\.file_objects\(school_id,id\)/);
});
test('only ready reservations can carry a committed file',()=>{
 assert.match(code,/state='ready' AND digest_sha256 IS NOT NULL/);
 assert.match(code,/file_id IS NOT NULL AND committed_at IS NOT NULL/);
});
test('audit review events have separate recipient and monotonically incremented revision',()=>{
 assert.match(code,/create table gestion\.review_events/i);
 assert.match(code,/FOREIGN KEY\(school_id,task_id,recipient_id\)/);
 assert.match(code,/new_revision=previous_revision\+1/);
});
test('open reconciliation cases cannot be duplicated by null uniqueness semantics',()=>{
 assert.match(code,/CREATE UNIQUE INDEX storage_reconciliation_open_unique/);
 assert.match(code,/WHERE resolved_at IS NULL/);
});
test('every added table has RLS fail closed without policies or grants',()=>{
 for(const table of ['storage_quotas','upload_reservations','review_events','storage_reconciliation']){
  assert.ok(code.toLowerCase().includes('create table gestion.'+table+' ('),'missing '+table);
  assert.ok(code.includes('ALTER TABLE gestion.'+table+' ENABLE ROW LEVEL SECURITY'),'RLS missing '+table);
 }
 assert.doesNotMatch(code,/\bcreate\s+policy\b/i);
 assert.doesNotMatch(code,/\bgrant\s+(select|insert|update|delete|all)\b/i);
 assert.match(code,/REVOKE ALL ON gestion\.storage_quotas/);
});
