import test from 'node:test';
import assert from 'node:assert/strict';
import {getConfigurationStatus} from './configuration-probes.mjs';
const NOW=Date.parse('2026-11-20T19:00:00Z');
test('all modules pending without trusted operational evidence',async()=>{
 const p=await getConfigurationStatus({now:()=>NOW});
 assert.ok(p.every(x=>x.status!=='ready'));
 assert.equal(p.find(x=>x.id==='napsis').status,'not_connected');
});
test('healthy Docker marker without signed trace does not imply ready',async()=>{
 const p=await getConfigurationStatus({now:()=>NOW,probes:{clamav:async()=>({verified:true,checkedAt:NOW,healthy:true})}});
 assert.equal(p.find(x=>x.id==='clamav').status,'pending');
});
test('verified recent check with evidence reference may mark ready',async()=>{
 const p=await getConfigurationStatus({now:()=>NOW,probes:{storage:async()=>({verified:true,checkedAt:NOW-1000,evidenceId:'internal-smoke-storage-001'})}});
 assert.equal(p.find(x=>x.id==='storage').status,'ready');
});
test('stale checks never mark ready',async()=>{
 const p=await getConfigurationStatus({now:()=>NOW,probes:{identity:async()=>({verified:true,checkedAt:NOW-86400000,evidenceId:'internal-smoke-auth-001'})}});
 assert.equal(p.find(x=>x.id==='identity').status,'pending');
});
test('failed checks cannot leak secrets or internal error messages',async()=>{
 const p=await getConfigurationStatus({now:()=>NOW,probes:{storage:async()=>{throw Error('password=/root/.secret')}}});
 const row=p.find(x=>x.id==='storage');
 assert.equal(row.status,'blocked');assert.doesNotMatch(JSON.stringify(row),/password|secret/);
});
test('no unofficial gradebook integration can be marked connected via probes',async()=>{
 const p=await getConfigurationStatus({now:()=>NOW,probes:{napsis:async()=>({verified:true,checkedAt:NOW,evidenceId:'fake-live-napsis-123'})}});
 assert.equal(p.find(x=>x.id==='napsis').status,'not_connected');
});
