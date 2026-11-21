import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('./DELL_POSTGRES_GESTION_DRAFT.sql',import.meta.url),'utf8');
const noComments=sql.replace(/--[^\n]*/g,'');
const tables=['schools','memberships','oversight_grants','folders','folder_access','file_objects','task_templates','tasks','task_recipients','evidence','notifications','audit_events'];
test('draft targets local PostgreSQL and is not applied to Supabase',()=>{
 assert.match(sql,/Dell PostgreSQL 17/);
 assert.match(sql,/DO NOT APPLY/);
 assert.doesNotMatch(noComments,/auth\.users|storage\.objects|supabase\./i);
});
test('only HUB content metadata, not school grades or attendance',()=>{
 for(const n of ['files','folders','tasks','task_recipients','evidence'])assert.match(noComments,new RegExp(n));
 assert.doesNotMatch(noComments,/create\s+table\s+(?:public|gestion)\.(?:grades|attendance|enrollment|matriculas)/i);
});
test('RLS enabled on each local metadata table and no grants yet',()=>{
 for(const t of tables)assert.ok(noComments.includes('create table gestion.'+t+'('),'Missing table '+t);
 assert.match(noComments,/enable row level security/);
 assert.match(noComments,/revoke all on gestion/);
 assert.doesNotMatch(noComments,/create policy/i);
 assert.doesNotMatch(noComments,/grant\s+(select|insert|update|delete)\s+on/i);
});
test('object metadata includes crypto and verified scanner result',()=>{
 for(const c of ['plain_sha256','gcm_iv','gcm_tag','antivirus_engine','antivirus_signature_version','encryption_key_version'])assert.match(noComments,new RegExp(c));
 assert.match(noComments,/check\(antivirus_engine='clamav'\)/);
});
test('all evidence links same tenant, task recipient and owner',()=>{
 assert.match(noComments,/foreign key\(school_id,task_id,recipient_id\)\s+references gestion\.task_recipients\(school_id,task_id,user_id\)/);
 assert.match(noComments,/foreign key\(school_id,file_id,recipient_id\)\s+references gestion\.file_objects\(school_id,id,owner_id\)/);
});
test('users are external UUIDs verified by trusted API, no password table',()=>{
 assert.doesNotMatch(noComments,/\bpassword\b|token_secret|oauth_refresh_token/i);
 assert.match(noComments,/approved_by uuid not null/);
});
test('per-recipient task state and review fields exist',()=>{
 assert.match(noComments,/primary key\(school_id,task_id,user_id\)/);
 assert.match(noComments,/reviewed_by uuid/);
 assert.match(noComments,/state in \('assigned','draft','submitted','returned','approved','cancelled'\)/);
});
