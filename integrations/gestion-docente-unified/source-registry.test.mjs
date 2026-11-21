import test from 'node:test';import assert from 'node:assert/strict';
import {GestionHub} from './hub-core.mjs';
import {SourceRegistry} from './source-registry.mjs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',S='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now=Date.parse('2026-11-20T12:00:00Z');
function setup(){
 let clock=now;const calls=[];
 const hub=new GestionHub({
  now:()=>clock,platformOperators:[A],
  verifySession:t=>t==='admin'?{userId:A,aal:'aal2',verified:true,expiresAt:now+10*86400000}:t==='user'?{userId:B,aal:'aal1',verified:true,expiresAt:now+10*86400000}:null,
  verifyUploadReceipt:async()=>null
 });
 hub.provisionSchool('admin',{id:S,name:'Colegio Ficticio',adminUserId:A});
 hub.addMember('admin',{schoolId:S,userId:B,group:'pie',expiresAt:now+10*86400000});
 const registry=new SourceRegistry({
  hub,now:()=>clock,
  verifyConsentTicket:async({ownerId,provider,consentTicket})=>{
   calls.push({type:'consent',ownerId,provider,consentTicket});
   if(consentTicket==='valid-ticket-12345')return {verified:true,handle:'opaque-vault-reference-'+provider,expiresAt:now+5*86400000};
   return {verified:false};
  },
  fetchMetadata:async({provider,ownerId,credentialHandle})=>{
   calls.push({type:'sync',provider,ownerId,credentialHandle});
   return [{id:'doc-01',title:'Planificación de Ciencias',type:'planning',url:'https://drive.google.com/file/d/example/view',modifiedAt:now,ownerId}];
  }
 });
 return {hub,registry,calls,advance:ms=>clock+=ms};
}
const rejects=(p,code)=>assert.rejects(p,e=>e.code===code);
test('registry offers EDUAI, Drive, Sheets, Docs, Gmail, Calendar, Napsis',()=>{
 const {registry}=setup();const p=registry.availableProviders().map(x=>x.provider);
 assert.deepEqual(p,['eduai_connect','google_drive','google_docs','google_sheets','gmail','google_calendar','napsis']);
});
test('all providers initially disconnected; official grades unverifiable',()=>{
 const {registry}=setup();const statuses=registry.status('user',S);
 assert.ok(statuses.every(s=>s.state==='not_connected'));
 assert.equal(statuses.find(s=>s.provider==='napsis').officialData,'not_verifiable');
});
test('consent needed for linking provider',async()=>{
 const {registry}=setup();
 await rejects(()=>registry.link('user',S,{provider:'google_drive',consentTicket:'bad'}),'CONSENT_REQUIRED');
 assert.equal(registry.status('user',S).find(s=>s.provider==='google_drive').state,'not_connected');
});
test('owner-linked consent, no raw OAuth tokens',async()=>{
 const {registry,calls}=setup();
 await registry.link('user',S,{provider:'google_drive',consentTicket:'valid-ticket-12345'});
 const s=registry.status('user',S).find(x=>x.provider==='google_drive');
 assert.equal(s.state,'connected');
 assert.equal(calls[0].ownerId,B);
 assert.doesNotMatch(JSON.stringify(s),/opaque-vault|access_token|refresh_token/);
});
test('trusted metadata sync and private search',async()=>{
 const {registry,calls}=setup();
 await registry.link('user',S,{provider:'google_drive',consentTicket:'valid-ticket-12345'});
 const result=await registry.sync('user',S,'google_drive');
 assert.equal(result.indexed,1);
 assert.equal(registry.searchOwn('user',S,{query:'planificación'}).length,1);
 assert.equal(registry.searchOwn('admin',S,{query:'planificación'}).length,0);
 assert.ok(calls.some(x=>x.type==='sync'&&x.credentialHandle.startsWith('opaque-vault')));
});
test('search is scoped to owner even when school admin',async()=>{
 const {registry}=setup();
 await registry.link('user',S,{provider:'google_drive',consentTicket:'valid-ticket-12345'});
 await registry.sync('user',S,'google_drive');
 assert.deepEqual(registry.searchOwn('admin',S),[]);
});
test('unlink removes indexed items immediately',async()=>{
 const {registry}=setup();
 await registry.link('user',S,{provider:'google_docs',consentTicket:'valid-ticket-12345'});
 await registry.sync('user',S,'google_docs');
 assert.equal(registry.searchOwn('user',S).length,1);
 registry.unlink('user',S,'google_docs');
 assert.equal(registry.searchOwn('user',S).length,0);
});
test('only owner may disconnect their connection',async()=>{
 const {registry}=setup();
 await registry.link('user',S,{provider:'google_drive',consentTicket:'valid-ticket-12345'});
 assert.throws(()=>registry.unlink('admin',S,'google_drive'),e=>e.code==='NOT_CONNECTED');
});
test('Gmail and Calendar never indexed as content',async()=>{
 const {registry,calls}=setup();
 await registry.link('user',S,{provider:'gmail',consentTicket:'valid-ticket-12345'});
 const r=await registry.sync('user',S,'gmail');
 assert.deepEqual(r,{provider:'gmail',status:'connected',indexed:0,restricted:true});
 assert.equal(registry.searchOwn('user',S,{query:'correo'}).length,0);
 assert.equal(calls.filter(x=>x.type==='sync').length,0);
});
test('Napsis cannot be connected without verified API integration',async()=>{
 const {registry}=setup();
 await rejects(()=>registry.link('user',S,{provider:'napsis',consentTicket:'valid-ticket-12345'}),'OFFICIAL_API_NOT_CONNECTED');
 const r=registry.externalVerification('user',S,{provider:'napsis',kind:'grades'});
 assert.equal(r.status,'not_verifiable');assert.equal(r.verified,false);
});
test('connection expiry prevents future search',async()=>{
 const {registry,advance}=setup();
 await registry.link('user',S,{provider:'google_drive',consentTicket:'valid-ticket-12345'});
 await registry.sync('user',S,'google_drive');
 advance(6*86400000);
 assert.equal(registry.status('user',S).find(x=>x.provider==='google_drive').state,'authorization_required');
 assert.equal(registry.searchOwn('user',S).length,0);
 await rejects(()=>registry.sync('user',S,'google_drive'),'AUTHORIZATION_EXPIRED');
});
test('connection becomes stale after 24h',async()=>{
 const {registry,advance}=setup();
 await registry.link('user',S,{provider:'google_drive',consentTicket:'valid-ticket-12345'});
 await registry.sync('user',S,'google_drive');
 advance(25*3600000);
 assert.equal(registry.status('user',S).find(x=>x.provider==='google_drive').state,'stale');
});
test('prohibit cross-owner metadata injection',async()=>{
 const {hub}=setup();
 const r=new SourceRegistry({hub,now:()=>now,verifyConsentTicket:async()=>({verified:true,handle:'opaque-handle',expiresAt:now+86400000}),fetchMetadata:async()=>[{id:'foreign',ownerId:A,title:'Privado',type:'file',url:'https://drive.google.com/test',modifiedAt:now}]});
 await r.link('user',S,{provider:'google_drive',consentTicket:'valid-ticket-12345'});
 await rejects(()=>r.sync('user',S,'google_drive'),'INVALID_METADATA');
});
test('source index never handles email message bodies or unauthorized grades',async()=>{
 const {registry}=setup();
 await registry.link('user',S,{provider:'gmail',consentTicket:'valid-ticket-12345'});
 assert.deepEqual(registry.searchOwn('user',S,{query:'private email'}),[]);
 assert.equal(registry.externalVerification('user',S,{provider:'napsis',kind:'attendance'}).status,'not_verifiable');
});
