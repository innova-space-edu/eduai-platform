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

const compareRoute=readFileSync('app/api/ai/training/compare/route.ts','utf8')
const feedbackUI=readFileSync('components/ai/TrainingFeedback.tsx','utf8')
const gateway=readFileSync('lib/ai/gateway.ts','utf8')
assert.ok(compareRoute.includes('consent.policy_version !== TRAINING_POLICY_VERSION'))
assert.ok(compareRoute.includes('isAdult(profile?.birth_date)'))
assert.ok(compareRoute.includes('captureTraining: false'), 'The unselected B must never be auto-captured')
assert.ok(compareRoute.includes('prepareTrainingPair(prompt, answerB)'))
assert.ok(compareRoute.includes('no corregir su ortografía'))
assert.ok(gateway.includes('if (input.captureTraining !== false)'))
assert.ok(feedbackUI.includes('Comparar 2 respuestas'))
assert.ok(feedbackUI.includes('isMediaResult'), 'Do not train image/audio tool outputs as text')
assert.ok(feedbackUI.includes('Enviar respuesta'), 'A visible submission button is required')
assert.ok(feedbackUI.includes('Enviar respuesta ${choice}'), 'A/B button must identify the chosen answer')
assert.ok(feedbackUI.includes('setValidationHint'), 'Explain incomplete confirmation instead of silently returning')
assert.ok(feedbackUI.includes('Para enviar, marca la casilla'), 'Retain explicit privacy acknowledgement')
assert.ok(feedbackUI.includes('disabled={busy}'), 'Submission remains clickable even before confirming')
assert.ok(feedbackUI.includes('choice === "B" ? "corrected"'))


// Regression: A/B cards must render readable Markdown + LaTeX rather than raw source.
const comparisonSection = feedbackUI.slice(feedbackUI.indexOf('      {alternative && ('), feedbackUI.indexOf('      {rating && ('))
assert.ok(feedbackUI.includes('import MathRenderer from "@/components/ui/MathRenderer"'), 'Use the shared trusted renderer')
assert.ok(comparisonSection.includes('<MathRenderer'), 'Both A/B responses must be rendered')
assert.ok(comparisonSection.includes('content={option.text}'), 'Preview both source responses without changing training data')
assert.ok(!comparisonSection.includes('{option.text}\n'), 'Never display raw A/B content')
assert.ok(comparisonSection.includes('role="radiogroup"'), 'Keep the accessible A/B selector')
assert.ok(comparisonSection.includes('checked={choice === option.key}'), 'Keep controlled A/B selection')
assert.ok(feedbackUI.includes('content={correction}'), 'Render edited corrections as a live visual preview')
assert.ok(feedbackUI.includes('setConfirmed(false)'), 'Explicit consent confirmation must remain intact')

const { prepareRichChatContent } = await import('../lib/text/prepare-rich-chat-content.ts')
const legacyQuadratic = '**Fórmula cuadrática**\n\n\\[\nax^{2}+bx+c=0 \\quad (a\\neq 0)\n\\]'
const normalizedQuadratic = prepareRichChatContent(legacyQuadratic)
assert.ok(normalizedQuadratic.includes('**Fórmula cuadrática**'))
assert.ok(normalizedQuadratic.includes('$$'))
assert.ok(!normalizedQuadratic.includes('\\['))
const alternativeQuadratic = 'Las raíces se obtienen con:\n\n$$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$'
assert.ok(prepareRichChatContent(alternativeQuadratic).includes('$$'))

const [{ createElement }, { renderToStaticMarkup }, { default: ReactMarkdown }, { default: remarkMath }, { default: rehypeKatex }] = await Promise.all([
  import('react'), import('react-dom/server'), import('react-markdown'), import('remark-math'), import('rehype-katex'),
])
function renderMathHTML(source) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  }, prepareRichChatContent(source)))
}
const originalPreviewHTML = renderMathHTML(legacyQuadratic)
const alternativePreviewHTML = renderMathHTML(alternativeQuadratic)
assert.match(originalPreviewHTML, /class="katex/, 'Legacy LaTeX must render through KaTeX')
assert.match(alternativePreviewHTML, /class="katex/, 'Alternative $$ LaTeX must render through KaTeX')
assert.ok(!originalPreviewHTML.includes('\\\\['), 'No raw display delimiters in generated HTML')
assert.ok(!alternativePreviewHTML.split('<annotation')[0].includes('\\frac'), 'No raw formula command in visible HTML')

console.log('Training contributions: consent gate, privacy filters, no hidden prompts/attachments, safe shapes, grouped splits and rejected originals passed')
