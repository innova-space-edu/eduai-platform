#!/usr/bin/env python3
"""Build reviewed, source-linked adaptations. Never republishes downloaded PDF text.
Input inventory and PDFs stay in scratch; only URL metadata and original adaptations
are committed. Reruns generate stable hashes and an idempotent insert-only SQL file.
"""
import hashlib,json,pathlib,re,unicodedata,collections
ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/'data/parvularia/web-2026-11'
RESEARCH=ROOT/'research/parvularia-web'
LEVELS=['Sala Cuna Menor (0 a 1 año)','Sala Cuna Mayor (1 a 2 años)','Medio Menor (2 a 3 años)','Medio Mayor (3 a 4 años)','NT1 - Pre Kinder (4-5 años)','NT2 - Kinder (5-6 años)']
NUCLEI={'IA':('Desarrollo personal y social','Identidad y autonomía'),'CC':('Desarrollo personal y social','Convivencia y ciudadanía'),'CM':('Desarrollo personal y social','Corporalidad y movimiento'),'LV':('Comunicación integral','Lenguaje verbal'),'LA':('Comunicación integral','Lenguajes artísticos'),'EEN':('Interacción y comprensión del entorno','Exploración del entorno natural'),'CES':('Interacción y comprensión del entorno','Comprensión del entorno sociocultural'),'PM':('Interacción y comprensión del entorno','Pensamiento matemático')}
def digest(s):return hashlib.sha256(s.encode()).hexdigest()
def norm(s):return re.sub(r'\W+',' ',unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()).strip()
seeds=[]
for line in (DATA/'curation.tsv').read_text().splitlines():
 if not line.strip() or line.startswith('#'):continue
 parts=line.split('|');assert len(parts)==6,(len(parts),line)
 seeds.append(dict(zip(['key','nucleus','title','mechanic','materials','observable'],parts)))
bykey={}
excluded=[]
public_inventory=DATA/'source-inventory.json'
if public_inventory.exists():
 for item in json.loads(public_inventory.read_text()):bykey[item['key']]=item
 excluded=json.loads((DATA/'excluded.json').read_text())
else:
 for item in json.loads((RESEARCH/'pdf-inventory.json').read_text()):
  if item.get('error'):excluded.append({'url':item['url'],'reason':'download_failed'});continue
  text=pathlib.Path(item['text_path']).read_text()
  if item['key'] not in {seed['key'] for seed in seeds} and not re.search(r'ACTIVIDADES PARA\s*APRENDER EN CASA|Edad recomendada|EDAD RECOMENDADA',text,re.I):
   excluded.append({'url':item['url'],'reason':'not_an_activity_or_unreadable'});continue
  item={**item,'text':text};bykey[item['key']]=item
for item in json.loads((DATA/'additional-sources.json').read_text()):bykey[item['key']]=item
public_rows=[]
sources=[];activities=[]
for key,item in bykey.items():
 related=[s for s in seeds if s['key']==key]
 provider='Fundación Integra' if item['group'].startswith('integra') else 'JUNJI' if item['group'].startswith('junji') else 'Educarchile / CEDUCA' if item['group'].startswith('educarchile') else 'MINEDUC'
 provider=item.get('provider',provider)
 title=item.get('title','')
 if title in ('','Ver las actividades'):title=' / '.join(s['title'] for s in related) or pathlib.PurePosixPath(item['url']).name
 levels=item.get('eligible_levels')
 if levels is None:
  group=item['group'];levels=LEVELS[:2] if group.endswith('_sc') else LEVELS[2:4] if group=='integra_nm' else LEVELS[4:] if group=='integra_nt' else LEVELS[3:]
  # Document ages take precedence over the collection label.
  text=item.get('text','')
  if group.startswith('junji') and re.search(r'de\s*0\s*[-a]\s*[23]\s*años',text,re.I):levels=LEVELS[:2]
 sourcehash=digest('eduai-web-source-v1:'+item['url'])
 meta={'source_url':item['url'],'landing_page':item['page'],'source_provider':provider,'retrieved_on':'2026-11-06','eligible_levels':levels,'review_state':'adaptations_reviewed' if related else 'reference_pending_review','copyright_policy':'link_metadata_and_original_adaptations_only','review_method':'assistant_content_and_safety_review_not_teacher_approval'}
 if 'text' in item:meta['downloaded_text_sha256']=digest(item['text'])
 elif item.get('downloaded_text_sha256'):meta['downloaded_text_sha256']=item['downloaded_text_sha256']
 public_rows.append({k:v for k,v in {**item,'eligible_levels':levels,'downloaded_text_sha256':meta.get('downloaded_text_sha256')}.items() if k in ['key','url','page','group','title','provider','eligible_levels','downloaded_text_sha256']})
 sources.append({'corpus_key':'parvularia-web-2026-11','source_hash':sourcehash,'file_name':title[:240],'source_type':'web_reference','category':'experiencias_web','level':' + '.join(levels),'topic':title[:240],'raw_text':f'Referencia de {provider}. Consulta el recurso original en {item["url"]}. Adaptaciones pedagógicas disponibles: '+('; '.join(s['title'] for s in related) or 'Pendiente de revisión de contenido, edad y seguridad.'),'metadata':meta,'active':bool(related)})
 for seed in related:
  ambito,nucleo=NUCLEI[seed['nucleus']]
  inicio='Presentar el material y recoger una señal de interés; ofrecer participar, observar o retirarse sin presión.'
  desarrollo=seed['mechanic']+' Ofrecer apoyos de acceso y comunicación, respetar la iniciativa infantil y observar cómo cambia su estrategia.'
  cierre='Recoger con palabras, gestos o una representación lo que descubrió; anticipar una posible continuidad según su interés.'
  evaluation='Registro de observación: '+seed['observable']+'. Consignar la acción y el apoyo requerido, sin calificar la personalidad.'
  resources=seed['materials']+'. Supervisión cercana y revisión previa del espacio, higiene y materiales; sin piezas pequeñas accesibles ni cordones al cuello.'
  experience=f'Inicio: {inicio}\nDesarrollo: {desarrollo}\nFinalización: {cierre}'
  assert len(seed['mechanic'])>=110
  # This is an EduAI adaptation, not a claim of institutional authorship or official OA.
  activity={'source_hash':sourcehash,'activity_key':digest('eduai-web-adaptation-v1:'+key+':'+seed['title']),'level':levels[0] if len(levels)==1 else 'Sala Cuna' if levels==LEVELS[:2] else 'Nivel Medio' if levels==LEVELS[2:4] else 'Nivel Medio Mayor y Transición' if levels==LEVELS[3:] else 'Nivel Transición','topic':seed['title'],'ambito_nucleo':ambito+' / '+nucleo,'oa_text':None,'oat_text':None,'skill_text':seed['observable'],'experience_text':experience,'inicio':inicio,'desarrollo':desarrollo,'cierre':cierre,'evaluation':evaluation,'resources':resources,'tags':['adaptacion_eduai','fuente_web_verificada',seed['nucleus']],'quality_score':8,'search_text':' '.join([*levels,nucleo,seed['title'],seed['mechanic'],seed['observable']]),'metadata':{**meta,'review_state':'adaptation_reviewed','source_activity_key':key,'adaptation_author':'EduAI','official_oa_assigned':False,'pedagogical_purpose':seed['observable']},'active':True}
  activities.append(activity)
missing=set(s['key'] for s in seeds)-set(bykey);assert not missing,missing
assert len({a['activity_key'] for a in activities})==len(activities)
# Reject near copies within the new corpus using meaningful mechanics rather than shared scaffolding.
sets=[set(norm(s['mechanic']).split()) for s in seeds]
near=[]
for i in range(len(sets)):
 for j in range(i):
  sim=len(sets[i]&sets[j])/max(1,len(sets[i]|sets[j]))
  if sim>.8:near.append((i,j,sim))
assert not near,near
public_inventory.write_text(json.dumps(public_rows,ensure_ascii=False,indent=2)+'\n')
payload={'sources':sources,'activities':activities}
(DATA/'corpus.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
(DATA/'excluded.json').write_text(json.dumps(excluded,ensure_ascii=False,indent=2)+'\n')
coverage={l:{n:sum(l in a['metadata']['eligible_levels'] and a['ambito_nucleo'].endswith(n) for a in activities) for _,n in NUCLEI.values()} for l in LEVELS}
report={'sources_catalogued':len(sources),'sources_with_reviewed_adaptations':sum(s['active'] for s in sources),'new_adaptations':len(activities),'pending_reference_sources':sum(not s['active'] for s in sources),'excluded_links':len(excluded),'coverage_new_adaptations':coverage,'note':'Coverage is new adaptations only; existing bank is preserved. No claim of exhaustive web coverage. No official OA invented. Raw downloaded text is not published.'}
(DATA/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# Data-only, insert-only import: no DDL, no replacement of existing corpus or user data.
encoded=json.dumps(payload,ensure_ascii=False)
assert '$eduai$' not in encoded
sql="""-- Verified external references and original EduAI adaptations. Idempotent, insert-only.
with payload as (select $eduai$"""+encoded+"""$eduai$::jsonb as data),
source_rows as (select * from jsonb_populate_recordset(null::public.parvularia_corpus_sources,(select data->'sources' from payload))),
inserted as (
 insert into public.parvularia_corpus_sources(corpus_key,source_hash,file_name,source_type,category,level,topic,raw_text,metadata,active)
 select corpus_key,source_hash,file_name,source_type,category,level,topic,raw_text,metadata,active from source_rows
 on conflict(source_hash) do nothing returning id,source_hash
), source_ids as (select id,source_hash from inserted union all select id,source_hash from public.parvularia_corpus_sources),
activity_rows as (select * from jsonb_array_elements((select data->'activities' from payload))),
inserted_activities as (
 insert into public.parvularia_activity_bank(source_id,activity_key,level,topic,ambito_nucleo,oa_text,oat_text,skill_text,experience_text,inicio,desarrollo,cierre,evaluation,resources,tags,quality_score,search_text,metadata,active)
 select s.id,a->>'activity_key',a->>'level',a->>'topic',a->>'ambito_nucleo',nullif(a->>'oa_text',''),nullif(a->>'oat_text',''),a->>'skill_text',a->>'experience_text',a->>'inicio',a->>'desarrollo',a->>'cierre',a->>'evaluation',a->>'resources',array(select jsonb_array_elements_text(a->'tags')),(a->>'quality_score')::numeric,a->>'search_text',a->'metadata',(a->>'active')::boolean
 from activity_rows r(a) join source_ids s on s.source_hash=a->>'source_hash'
 on conflict(activity_key) do nothing returning id
) select jsonb_build_object('sources_inserted',(select count(*) from inserted),'activities_inserted',(select count(*) from inserted_activities));
"""
(ROOT/'sql/import-parvularia-web-2026-11.sql').write_text(sql)
print(json.dumps(report,ensure_ascii=False,indent=2))
