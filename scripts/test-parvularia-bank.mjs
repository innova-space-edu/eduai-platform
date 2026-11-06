import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
registerHooks({load(url,context,next){if(url.endsWith('.ts'))return{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8')),shortCircuit:true};return next(url,context)}})
const {readParvulariaBank,compatibleParvulariaReference,buildParvulariaKnowledgeContext,evaluateParvulariaNovelty}=await import('../lib/parvularia-knowledge.ts')
const levels=['Sala Cuna Menor (0 a 1 año)','Sala Cuna Mayor (1 a 2 años)']
const nucleus='Lenguaje verbal'
const activity=(id,level=levels[0],nucleo=nucleus)=>({id,level,nucleo_canon:nucleo,experience_text:'El grupo observa imágenes familiares, señala objetos y alterna vocalizaciones con la educadora, quien responde y amplía el significado de cada gesto, acompañando una conversación lúdica que respeta el ritmo individual.',desarrollo:'Desarrollo detallado '.repeat(35),inicio:'Preparación afectiva '.repeat(8),cierre:'Recoger señales y comunicar lo explorado '.repeat(3),source_id:id})
assert.ok(compatibleParvulariaReference(activity('1'),levels,nucleus))
assert.ok(!compatibleParvulariaReference(activity('1'),['NT2 - Kinder (5-6 años)'],nucleus))
assert.ok(!compatibleParvulariaReference(activity('1'),levels,'Pensamiento matemático'))
assert.ok(!compatibleParvulariaReference({...activity('1'),nucleo_canon:null,ambito_nucleo:null},levels,nucleus))
const rows=Array.from({length:650},(_,i)=>activity(String(i)))
const ranges=[]
const db={from(table){let range=[0,0];return{select(){return this},eq(){return this},order(){return this},limit(){return this},range(a,b){range=[a,b];return this},then(resolve,reject){if(table==='parvularia_activity_bank')ranges.push(range);return Promise.resolve({data:table==='parvularia_activity_bank'?rows.slice(range[0],range[1]+1):[],error:null}).then(resolve,reject)}}},rpc:async()=>({data:[],error:null})}
const bank=await readParvulariaBank(db);assert.equal(bank.activities.length,650);assert.equal(bank.complete,true);assert.deepEqual(ranges,[[0,249],[250,499],[500,749]])
const ctx=await buildParvulariaKnowledgeContext({supabase:db,userId:'owner',course:levels[0],topic:'familia',message:'conversar',journeyNuclei:[nucleus,'Pensamiento matemático','Lenguajes artísticos'],selectedOAIds:[],selectedOATIds:[],candidateLimit:9})
assert.equal(ctx.bankScannedCount,650);assert.equal(ctx.journeyCoverage[1].needsWeb,true);assert.equal(ctx.journeyReferenceCounts[1],0);assert.equal(ctx.journeyReferenceCounts[2],0)
assert.ok(ctx.journeyPrompts[0].includes('Desarrollo detallado'))
const repeated=JSON.stringify({filas:[{experienciaAprendizaje:'Inicio: encuentro\nDesarrollo:\nLunes 1: '+activity('x').experience_text+'\nMartes 2: '+activity('x').experience_text+'\nFinalización: cierre'}]})
assert.equal(evaluateParvulariaNovelty(repeated,[]).passed,false,'reject repeated activities within a fresh document')
const route=readFileSync(new URL('../app/api/agents/educador/route.ts',import.meta.url),'utf8')
assert.ok(route.includes('forceNew: forceNewGeneration || isStructuredParvularia'))
assert.ok(route.indexOf('await buildParvulariaKnowledgeContext')<route.indexOf('await searchMissingParvulariaIdeas'))
const web=readFileSync(new URL('../lib/parvularia-web.ts',import.meta.url),'utf8');assert.ok(web.includes('if (!gaps.length) return empty("bank_sufficient")'));assert.ok(!web.includes('input.topic'));assert.ok(web.includes('!result.usedSearch || !sources.length'))
console.log('Parvularia: paginated bank, age/nucleus scope, gaps, detailed references and within-document novelty passed')
