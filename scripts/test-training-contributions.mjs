import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {registerHooks,stripTypeScriptTypes} from 'node:module'
registerHooks({resolve(spec,ctx,next){if(spec==='./safety')return next('./safety.ts',ctx);return next(spec,ctx)},load(url,ctx,next){if(url.endsWith('.ts'))return {format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8')),shortCircuit:true};return next(url,ctx)}})
const {prepareTrainingPair,validatedTrainingPair,trainingSplit,trainingFingerprint}=await import('../lib/ai/training/safety.ts')
const {captureTrainingCandidate}=await import('../lib/ai/training/capture.ts')
const prompt='Propón una actividad sobre patrones con bloques grandes.'
const answer='Los niños ordenan bloques grandes por forma y explican cómo continuar la secuencia.'
const pair=prepareTrainingPair(prompt,answer)
assert.equal(pair.length,3)
for(const value of ['Escribe al correo persona@example.com','Mi nombre es Test Persona','RUT 12.345.678-9','api_key = abcdefghijklmnopqrst','Consulta https://ejemplo.cl/privado']) assert.equal(prepareTrainingPair(value,answer),null)
assert.equal(validatedTrainingPair([null,null,null]),null)
assert.equal(validatedTrainingPair([{role:'system',content:'x'},false,{}]),null)
assert.equal(trainingSplit(pair),trainingSplit(prepareTrainingPair(prompt,answer+' Otra respuesta.')))
assert.notEqual(trainingFingerprint(pair),trainingFingerprint(prepareTrainingPair(prompt,answer+' Otra respuesta.')))
let written=[]
function client(consent){return {from(table){return{select(){return this},eq(){return this},abortSignal(){return this},async maybeSingle(){return {data:consent?{owner_id:'self'}:null,error:null}},upsert(row){written.push({table,row});return this},then(resolve){return Promise.resolve({error:null}).then(resolve)}}}}}
const input={userId:'self',module:'test',messages:[{role:'system',content:'PRIVATE SYSTEM MUST NOT BE COPIED'},{role:'user',content:prompt}],answer}
await captureTrainingCandidate({...input,supabase:client(false)});assert.equal(written.length,0)
await captureTrainingCandidate({...input,supabase:client(true)});assert.equal(written.length,1)
assert.equal(written[0].row.origin,'generation')
assert.equal(written[0].row.status,undefined)
assert.ok(!JSON.stringify(written[0]).includes('PRIVATE SYSTEM'))
written=[];await captureTrainingCandidate({...input,supabase:client(true),messages:[{role:'user',content:[{image:'private'}]}]});assert.equal(written.length,0)
const route=readFileSync('app/api/admin/ai-core/training/route.ts','utf8')
assert.ok(route.includes('trainingUser(true)'))
assert.ok(route.includes('export_eduai_training_dataset'))
const feedback=readFileSync('app/api/ai/training/route.ts','utf8')
assert.ok(feedback.includes('isAdult(profile?.birth_date)'))
assert.ok(feedback.includes('excludeError'))
console.log('Training contributions: consent gate, privacy filters, no hidden prompts/attachments, safe shapes, grouped splits and rejected originals passed')
