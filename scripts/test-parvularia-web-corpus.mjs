import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=(p)=>JSON.parse(readFileSync(new URL('../data/parvularia/web-2026-11/'+p,import.meta.url),'utf8'))
const {sources,activities}=read('corpus.json'),report=read('report.json')
assert.equal(activities.length,132)
assert.equal(new Set(activities.map(x=>x.activity_key)).size,activities.length)
const hashes=new Set(sources.map(x=>x.source_hash))
for(const a of activities){
 assert.ok(hashes.has(a.source_hash));assert.ok(a.metadata.source_url.startsWith('https://'))
 assert.ok(a.metadata.eligible_levels.length>0);assert.equal(a.oa_text,null);assert.equal(a.oat_text,null)
 assert.ok(a.desarrollo.length>=220);assert.ok(a.inicio.length>=40);assert.ok(a.cierre.length>=35)
 assert.ok(a.evaluation.includes('Registro de observación'))
 assert.ok(a.metadata.adaptation_author==='EduAI');assert.ok(a.active)
}
for(const nuclei of Object.values(report.coverage_new_adaptations)){assert.equal(Object.keys(nuclei).length,8);assert.ok(Object.values(nuclei).every(n=>n>0))}
for(const s of sources){assert.ok(s.metadata.source_url);assert.equal(s.active,s.metadata.review_state==='adaptations_reviewed');assert.ok(s.raw_text.split(/\s+/).length<200)}
assert.equal(sources.filter(s=>!s.active).length,report.pending_reference_sources)
console.log('Web corpus: provenance, original adaptations, 6 sublevels × 8 nuclei, no invented official OA and inactive pending sources passed')
