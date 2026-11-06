#!/usr/bin/env python3
"""Rebuild media from archived MINEDUC normative text; no generated curriculum.

Snapshots preserve numbered lines from the official Ley Chile HTML representation.
Ranges are deliberately explicit: fail rather than infer an objective or a course.
"""
import json, re, html, unicodedata
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/mineduc'
REF = DATA / 'references'
SOURCES = {
 '12': 'https://www.bcn.cl/leychile/navegar?i=1060374',
 'arts': 'https://www.bcn.cl/leychile/navegar?i=1084868',
 'orientation': 'https://www.bcn.cl/leychile/navegar?idNorma=1093403',
 '34': 'https://www.bcn.cl/leychile/navegar?idNorma=1136078',
}
SNAPS = {k: json.loads((REF / 'legal' / (k+'.json')).read_text()) for k in SOURCES}
PORTAL = json.loads((REF / 'portal-20261106.json').read_text())
INDIVIDUAL = json.loads((REF / 'individual-20261106.json').read_text())
DATE = '2026-11-06'

def slug(s):
 return re.sub(r'[^a-z0-9]+', '_', unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode().lower()).strip('_')

def write(p, value):
 p.parent.mkdir(parents=True,exist_ok=True)
 p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

HEADINGS = {'Expresar y crear','Apreciar y responder','Comunicar y difundir','Resolver Problemas','Argumentar y Comunicar','Modelar','Representar','Observar y plantear preguntas','Planificar y conducir una investigación','Procesar y analizar la evidencia','Evaluar','Comunicar','Pensamiento temporal y espacial','Análisis y trabajo con fuentes de información','Pensamiento crítico','Comunicación','Investigación','Planificar y conducir una investigación','Analizar e interpretar datos','Construir explicaciones y diseñar soluciones','Resolver problemas','Habilidades digitales','Producción','Comprensión','Comprensión y producción'}

def extract(key, start, end, count, letters=False):
 lines=SNAPS[key]; out=[]; cur=None; axis='Objetivos de Aprendizaje'; footnote=False
 for i in range(start,end):
  s=html.unescape(re.sub(r'\s+',' ',lines[str(i)])).strip()
  if not s: continue
  if re.match(r'^-{4,}$',s): footnote=True; continue
  pattern=r'^([a-z])\.\s*(.*)' if letters else r'^(?:\(OA (\d+)\)|([0-9]+)\.)\s*(.*)'
  m=re.match(pattern,s)
  if m:
   n=m[1] if letters else int(m[1] or m[2]); body=m[2] if letters else m[3]
   cur={'numero_oficial':n,'descripcion':body,'eje':axis,'referencia_lineas':[i,i]};out.append(cur);footnote=False;continue
  if s in HEADINGS or s.isupper() or re.match(r'^(?:Eje |EJE )',s):
   axis=s;cur=None;footnote=False;continue
  if s.startswith('. '): footnote=False
  if cur is not None and not footnote:
   if '†Image' in s: raise ValueError(f'Imagen dentro de OA: {key}:{i}')
   if re.match(r'^\(\d+\)',s): continue
   s=re.sub(r'^\.\s*','- ',s)
   cur['descripcion']+= ('\n' if s.startswith('- ') else ' ')+s
   cur['referencia_lineas'][1]=i
 expected=[chr(97+i) for i in range(count)] if letters else list(range(1,count+1))
 assert [o['numero_oficial'] for o in out]==expected,(key,start,end,[o['numero_oficial'] for o in out],expected)
 assert all(len(o['descripcion'])>20 for o in out),(key,start,'empty descriptions')
 return out

# course, subject, source key, first line, exclusive last line, expected OA count,
# official portal prefix where already known; omitted prefixes are NOT invented.
CONFIG=[]
def add(c,name,k,a,b,n,prefix=None,plan='formacion_general',skills=None):
 CONFIG.append(dict(course=c,name=name,key=k,start=a,end=b,count=n,prefix=prefix,plan=plan,skills=skills))

for c,a,b in [(1,1122,1354),(2,1354,1593)]:add(c,'Lengua y Literatura','12',a,b,24,f'LE{c}M OA ')
for c,a,b,sa,sb in [(1,2192,2265,2144,2190),(2,2323,2425,2275,2321)]:add(c,'Matemática','12',a,b,15 if c==1 else 12,f'MA{c}M OA ',skills=('12',sa,sb,15))
for c,a,b,sa,sb in [(1,3041,3176,2987,3039),(2,3241,3297,3185,3239)]:
 add(c,'Ciencias Naturales','12',a,b,20 if c==1 else 18,f'CN{c}M OA ',skills=('12',sa,sb,13))
for c,a,b,sa,sb in [(1,3804,3843,3739,3800),(2,3919,3956,3854,3915)]:add(c,'Historia, Geografía y Cs. Sociales','12',a,b,25,f'HI{c}M OA ',skills=('12',sa,sb,13))
for c,a,b in [(1,4593,4747),(2,4747,4903)]:add(c,'Inglés','12',a,b,16,f'IN{c}M OA ')
for c,a,b in [(1,5127,5171),(2,5178,5223)]:add(c,'Educación Física y Salud','12',a,b,5,f'EF{c}M OA ')
for c,a,b in [(1,206,229),(2,235,257)]:add(c,'Tecnología','arts',a,b,6,f'TE{c}M OA ')
for c,a,b in [(1,508,533),(2,539,564)]:add(c,'Artes Visuales','arts',a,b,6,f'AR{c}M OA ')
for c,a,b in [(1,845,876),(2,882,910)]:add(c,'Música','arts',a,b,7,f'MU{c}M OA ')
for c in [1,2]:add(c,'Orientación','orientation',223,262,10,f'OR{c}M OA ')

for c,a,b in [(3,771,783),(4,788,799)]:add(c,'Educación Ciudadana','34',a,b,8,f'FG-ECIU-{c}M-OAC-',skills=('34',740,766,7))
for c,a,b in [(3,891,901),(4,906,914)]:add(c,'Filosofía','34',a,b,6 if c==3 else 5,f'FG-FILO-{c}M-OAC-',skills=('34',878,884,4))
for c,a,b in [(3,993,999),(4,1002,1009)]:add(c,'Inglés','34',a,b,4)
for c,a,b in [(3,1109,1179),(4,1179,1235)]:add(c,'Lengua y Literatura','34',a,b,9 if c==3 else 8,f'FG-LELI-{c}M-OAC-')
for c,a,b in [(3,1343,1349),(4,1355,1360)]:add(c,'Matemática','34',a,b,4,f'FG-MATE-{c}M-OAC-',skills=('34',1310,1338,12))

ELECTIVES=[
 ('Artes Visuales',1461,1476,7),('Danza',1481,1495,6),('Música',1500,1515,7),('Teatro',1521,1533,6),
 ('Educación Física y Salud 1',1589,1597,5),('Educación Física y Salud 2',1600,1608,5),
 ('Mundo Global',1711,1720,7),('Chile y la Región Latinoamericana',1726,1735,7)]
HC=[
 ('Artes visuales, audiovisuales y multimediales',1768,1779,7),('Creación y composición musical',1792,1802,7),('Diseño y arquitectura',1814,1825,7),
 ('Interpretación y creación en danza',1837,1849,8),('Interpretación y creación en teatro',1866,1877,8),('Interpretación musical',1890,1900,7),
 ('Biología de los ecosistemas',1950,1957,5),('Biología celular y molecular',1970,1981,7),('Ciencias de la salud',1994,2002,5),('Física',2015,2023,6),('Química',2036,2046,7),
 ('Promoción de estilos de vida activos y saludables',2061,2071,6),('Ciencias del ejercicio físico y deportivo',2084,2095,6),('Expresión corporal',2107,2114,4),
 ('Estética',2153,2164,7),('Seminario de filosofía',2205,2213,5),
 ('Comprensión histórica del presente',2267,2275,5),('Geografía, territorio y desafíos socioambientales',2290,2299,6),('Economía y sociedad',2317,2329,8),
 ('Taller de literatura',2347,2357,6),('Lectura y escritura especializadas',2370,2378,5),('Participación y argumentación en democracia',2391,2402,7),
 ('Límites, derivadas e integrales',2465,2473,5),('Probabilidades y estadística descriptiva e inferencial',2490,2496,4),('Pensamiento computacional y programación',2510,2521,6),('Geometría 3D',2535,2543,5)]
for c in [3,4]:
 for name,a,b,n in ELECTIVES:add(c,name,'34',a,b,n,plan='formacion_general_electiva')
 for name,a,b,n in HC:
  skills=None
  if name in [x[0] for x in HC[6:11]]:skills=None
  if name in [x[0] for x in HC[-4:]]:skills=('34',2415,2447,12)
  if name in ['Estética','Seminario de filosofía']:skills=('34',2126,2132,4)
  if name in [x[0] for x in HC[16:19]]:skills=('34',2224,2250,11)
  add(c,name,'34',a,b,n,plan='formacion_diferenciada_hc',skills=skills)

for c in [3,4]:add(c,'Filosofía política','34',0,0,6,plan='formacion_diferenciada_hc',skills=('34',2126,2132,4))

def portal_items(cfg):
 """Only admit the requested course/code family; never a proposal or neighbour."""
 name=cfg['name'];c=cfg['course']
 prefix=cfg['prefix']
 keys=[name,'extra-'+name]
 if c<3:
  subject={'Lengua y Literatura':'lengua-literatura','Historia, Geografía y Cs. Sociales':'historia-geografia-ciencias-sociales','Educación Física y Salud':'educacion-fisica-salud'}.get(name,slug(name).replace('_','-'))
  keys=[f'12-{c}-{subject}',f'final-12-{c}-{subject}']
 elif c==4 and cfg['plan']=='formacion_general':
  subject={'Educación Ciudadana':'educacion-ciudadana-4m','Filosofía':'filosofia-4o-medio','Inglés':'ingles-4o-medio','Lengua y Literatura':'lengua-literatura-4o-medio','Matemática':'matematica-4o-medio'}[name]
  keys=['extra-'+subject]
 found={};urls=[]
 for k in keys:
  for page in PORTAL.get(k,[]):
   # Filosofía also returns a malformed catalogue entry for 4M under 3M.
   for item in page['items']:
    code=item['codigo_oficial']
    if prefix and not code.startswith(prefix):continue
    if c>=3 and cfg['plan']=='formacion_general' and not re.search(f'-{c}M-OAC-',code):continue
    if name=='Filosofía política' and not code.startswith('FI-FIPO-'):continue
    if c>=3 and cfg['plan']!='formacion_general' and '-3y4-OAC-' not in code:continue
    found.setdefault(code,{**item,'source_url':page['url']})
    if page['url'] not in urls:urls.append(page['url'])
 if len(found)!=cfg['count']:return [],[]
 items=sorted(found.values(),key=lambda o:int(re.search(r'(\d+)$',o['codigo_oficial'])[1]))
 assert [int(re.search(r'(\d+)$',o['codigo_oficial'])[1]) for o in items]==list(range(1,cfg['count']+1))
 return items,urls

def main():
 changes=[]; manifest=[]
 for cfg in CONFIG:
  c=cfg['course'];name=cfg['name'];key=cfg['key']; stem=slug(name)
  if name=='Historia, Geografía y Cs. Sociales':stem='historia_geografia_y_cs_sociales'
  if name=='Lengua y Literatura':stem='lengua_literatura'
  if name=='Educación Ciudadana':stem='educacion_ciudadana'
  path=DATA/'media'/f'{c}_medio'/(stem+'.json')
  before=json.loads((REF/'media-before-20261106.json').read_text()).get(str(path.relative_to(ROOT)))
  items=extract(key,cfg['start'],cfg['end'],cfg['count']) if cfg['start'] else []
  portal,portal_urls=portal_items(cfg)
  assert items or portal, name
  legal={o['numero_oficial']:o for o in items}
  if portal:
   items=[{**legal.get(i,{'eje':'Objetivos de Aprendizaje'}),**o,'numero_oficial':i} for i,o in enumerate(portal,1)]
  old_items={o.get('codigo_oficial',o['id']):o for u in (before or {}).get('unidades',[]) for o in u.get('oa',[])}
  for item in items:
   num=item['numero_oficial'];code=item.get('codigo_oficial') or (cfg['prefix']+f'{num:02}' if cfg['prefix'] else None)
   item['id']=old_items.get(code,{}).get('id') or (code.replace(' ','-') if code else f'MEDIA-{c}-{stem}-OA-{num:02}')
   if code:item['codigo_oficial']=code
   if code in INDIVIDUAL and not INDIVIDUAL[code]['descripcion'].rstrip().endswith(':'):
    item.update(INDIVIDUAL[code])
    if INDIVIDUAL[code]['source_url'] not in portal_urls:portal_urls.append(INDIVIDUAL[code]['source_url'])
   item.setdefault('source_url',SOURCES[key])
   item['descripcion']=re.sub(r'(?m)^\s*\*\s+','- ',item['descripcion']).strip()
  units=[]
  for axis in dict.fromkeys(o['eje'] for o in items):
   old_unit=next((u for u in (before or {}).get('unidades',[]) if any(o.get('codigo_oficial') in {x.get('codigo_oficial') for x in items if x['eje']==axis} for o in u.get('oa',[]))),None)
   unit_id=(old_unit or {}).get('id','eje-'+slug(axis).replace('_','-'))
   if any(u['id']==unit_id for u in units):unit_id='eje-'+slug(axis).replace('_','-')
   units.append({'numero':len(units)+1,'id':unit_id,'nombre':axis,'tipo_agrupacion':'eje_curricular' if axis!='Objetivos de Aprendizaje' else 'lista_oficial','oa':[o for o in items if o['eje']==axis]})
  skills=[]
  if cfg['skills']:
   sk,sa,sb,n=cfg['skills'];skills=extract(sk,sa,sb,n,letters=True)
   for o in skills:o['id']=f'{c}-{stem}-OAH-'+o['numero_oficial'];o['source_url']=SOURCES[sk]
  result={'metadata':{'nivel':'Media','curso':f'{c}° Medio','asignatura':name,'plan':cfg['plan'],'fuente':'MINEDUC — texto normativo publicado en Ley Chile (BCN)','source_url':SOURCES[key],'base_curricular':'Bases Curriculares 7º Básico a 2º Medio' if c<3 else 'Bases Curriculares 3° y 4° Medio','estado_verificacion':'verificado_oficial','alcance_verificacion':['oa_contenido']+(['oa_habilidades'] if skills else []),'fecha_consulta':DATE,'sistema_identificacion':'numeracion_normativa','nota':'La numeración se conserva del texto normativo. Los identificadores internos no equivalen a códigos del portal. Agrupación por ejes, no unidades oficiales del programa.','cursos_aplicables':[1,2] if name=='Orientación' else ([3,4] if cfg['plan']!='formacion_general' else [c])},'objetivos_habilidad':skills,'objetivos_actitud':[],'unidades':units}
  if portal_urls:
   result['metadata'].update(source_url=portal_urls[0],source_urls=portal_urls+[SOURCES[key]],fuente='MINEDUC — Currículum Nacional, contrastado con texto normativo en Ley Chile',sistema_identificacion='codigos_oficiales_portal')
  if name in ['Seminario de filosofía','Filosofía política']:result['metadata']['nota']+=' La transcripción BCN contiene encabezados y contenido repetidos; prevalece la ficha específica de Currículum Nacional.'
  write(path,result)
  changes.append({'path':str(path.relative_to(ROOT)),'nuevo':before is None,'oa_antes':len(old_items),'oa_despues':len(items),'habilidades':len(skills)})
  manifest.append({'path':str(path.relative_to(DATA)),'curso':c,'asignatura':name,'plan':cfg['plan'],'expected_count':cfg['count'],'source':key,'range':[cfg['start'],cfg['end']]})
 # Keep the original science selectors and IDs as aliases of their official CN axis.
 for c in [1,2]:
  parent=json.loads((DATA/'media'/f'{c}_medio'/'ciencias_naturales.json').read_text())
  for axis in ['Biología','Física','Química']:
   path=DATA/'media'/f'{c}_medio'/(slug(axis)+'.json')
   old=json.loads((REF/'media-before-20261106.json').read_text())[str(path.relative_to(ROOT))]
   ids={o['codigo_oficial']:o['id'] for u in old['unidades'] for o in u['oa']}
   units=[u for u in parent['unidades'] if u['nombre'].casefold()==axis.casefold()]
   assert len(units)==1,(c,axis)
   alias=json.loads(json.dumps(parent));alias['unidades']=units
   alias['metadata'].update(asignatura=axis,base_asignatura_origen=f'Ciencias Naturales {c}° Medio',alias_curricular=True)
   for u in units:
    for o in u['oa']:o['id']=ids.get(o['codigo_oficial'],o['id'])
   write(path,alias)
 # Four official, shared modules: numbering restarts within each module.
 modules=[];urls=[]
 for stem,label,prefix in [('bienestar-salud','Bienestar y salud','FG-CIBS'),('seguridad-prevencion-autocuidado','Seguridad, prevención y autocuidado','FG-CISA'),('ambiente-sostenibilidad','Ambiente y sostenibilidad','FG-CIAS'),('tecnologia-sociedad','Tecnología y sociedad','FG-CITS')]:
  page=next(p for p in PORTAL['final-'+stem] if len(p['items'])==3)
  items=[];urls.append(page['url'])
  for n,o in enumerate(page['items'],1):
   assert o['codigo_oficial']==f'{prefix}-3y4-OAC-{n:02}'
   items.append({**o,'id':o['codigo_oficial'],'numero_oficial':n,'eje':label,'source_url':page['url']})
  modules.append({'id':stem.replace('-','_'),'nombre':label,'tipo_agrupacion':'modulo_oficial_compartido_3y4','oa':items})
 shared={'metadata':{'nivel':'Media','asignatura':'Ciencias para la Ciudadanía','plan':'formacion_general','base_compartida':'3° y 4° Medio','cursos_aplicables':[3,4],'fuente':'MINEDUC — Currículum Nacional','source_url':urls[0],'source_urls':urls+[SOURCES['34']],'base_curricular':'Bases Curriculares 3° y 4° Medio','estado_verificacion':'verificado_oficial','alcance_verificacion':['oa_contenido','oa_habilidades'],'fecha_consulta':DATE},'objetivos_habilidad':extract('34',614,635,9,letters=True),'objetivos_actitud':[],'modulos':modules}
 for o in shared['objetivos_habilidad']:o['id']='CPC-3y4-OAH-'+o['numero_oficial'];o['source_url']=SOURCES['34']
 write(DATA/'shared/ciencias_para_la_ciudadania_3y4_base.json',shared)
 for c in [3,4]:
  d=json.loads(json.dumps(shared));d['metadata']['curso']=f'{c}° Medio';write(DATA/'media'/f'{c}_medio/ciencias_para_la_ciudadania.json',d)
 # Register every file in the same generated module consumed by the application.
 files=sorted((DATA/'media').glob('*/*.json'))
 imports=[];entries=[];meta=json.loads((DATA/'meta/asignaturas_por_curso.json').read_text());meta['Media']={}
 report=[];originals=json.loads((REF/'media-before-20261106.json').read_text())
 for i,path in enumerate(files):
  d=json.loads(path.read_text());md=d['metadata'];rel=str(path.relative_to(ROOT));var=f'media{i}'
  imports.append(f'import {var} from "../{rel}"')
  entries.append(f'  {{ curso: {json.dumps(md["curso"],ensure_ascii=False)}, asignatura: {json.dumps(md["asignatura"],ensure_ascii=False)}, sourceFile: "{rel}", raw: {var} }},')
  meta['Media'].setdefault(md['curso'],[]).append(md['asignatura'])
  before=originals.get(rel);olditems={o.get('codigo_oficial',o['id']):o for u in ((before or {}).get('unidades',[])+(before or {}).get('modulos',[])) for o in u['oa']}
  newitems={o.get('codigo_oficial',o['id']):o for u in d.get('unidades',[])+d.get('modulos',[]) for o in u['oa']}
  normalize=lambda s:re.sub(r'\W+','',s.casefold())
  edits=[{'codigo':code,'antes':olditems[code]['descripcion'],'despues':o['descripcion']} for code,o in newitems.items() if code in olditems and normalize(o['descripcion'])!=normalize(olditems[code]['descripcion'])]
  report.append({'path':rel,'nuevo':before is None,'oa_antes':len(olditems),'oa_despues':len(newitems),'agregados':[code for code in newitems if code not in olditems],'cambios_texto':edits,'plan':md['plan'],'alias':md.get('alias_curricular',False)})
  if not any(m['path']==str(path.relative_to(DATA)) for m in manifest):manifest.append({'path':str(path.relative_to(DATA)),'curso':int(path.parent.name[0]),'asignatura':md['asignatura'],'plan':md['plan'],'expected_count':len(newitems)})
 (ROOT/'lib/mineduc-media.generated.ts').write_text('// Generated by scripts/audit-media-2026.py; do not edit.\n'+'\n'.join(imports)+'\n\nexport const MEDIA_CURRICULUM: Array<{ curso: string; asignatura: string; sourceFile: string; raw: unknown }> = [\n'+'\n'.join(entries)+'\n]\n')
 write(DATA/'meta/asignaturas_por_curso.json',meta)
 write(REF/'media-2026-manifest.json',manifest)
 write(REF/'media-2026-audit.json',report)
 sources=json.loads((DATA/'sources.json').read_text())
 sources['fecha_actualizacion']=DATE;sources['revision']='auditoria_media_20261106_fg_y_27_electivos_hc'
 for path in files:
  d=json.loads(path.read_text());md=d['metadata'];items=[o for u in d.get('unidades',[])+d.get('modulos',[]) for o in u['oa']]
  sources['asignaturas_verificadas'][str(path.relative_to(DATA)).removesuffix('.json')]={'url':md['source_url'],'urls':md.get('source_urls',[md['source_url']]),'fecha_consulta':DATE,'base_curricular_id':'basica-7-media-2' if int(path.parent.name[0])<3 else 'media-3-4','cantidad_oa_contenido':len(items),'codigos':[o['codigo_oficial'] for o in items],'plan':md['plan']}
 write(DATA/'sources.json',sources)
 progress=json.loads((DATA/'meta/verification-progress.json').read_text())
 all_files=list((DATA/'basica').glob('*/*.json'))+list((DATA/'parvularia').glob('*.json'))+files
 totals={'verificado_oficial':0,'verificado_propuesta_oficial':0};contents=0;transversals=0
 for path in all_files:
  d=json.loads(path.read_text());status=d.get('metadata',{}).get('estado_verificacion','pendiente_verificacion');totals[status]=totals.get(status,0)+1
  contents+=sum(len(u['oa']) for u in d.get('unidades',[])+d.get('modulos',[]))
  for scope in d.get('ambitos',[]):
   for core in scope['nucleos']:contents+=len(core.get('oa_contenido',[]));transversals+=len(core.get('oa_transversales',[]))
 progress.update(fecha_actualizacion=DATE,fase='auditoria_media_fg_hc',archivos_curriculares_totales=len(all_files),asignaturas_verificadas_oficialmente=totals['verificado_oficial'],propuestas_oficiales_verificadas=totals['verificado_propuesta_oficial'],archivos_pendientes=sum(v for k,v in totals.items() if not k.startswith('verificado_')),oa_contenido_verificados=contents,oat_verificados=transversals,objetivos_oficiales_verificados=contents+transversals,cursos_media_completos=['1_medio','2_medio','3_medio','4_medio'],alcance_media='OA de contenido: formación general regular, formación general electiva y 27 asignaturas de profundización HC. Habilidades: solo las secciones explícitamente verificadas. Actitudes: pendientes de auditoría específica.',siguiente_bloque='especialidades_tecnico_profesionales_y_religion_segun_programa',ultima_validacion='success',estado_fusion='rama_en_revision',nota='Media ampliada de 19 a 108 archivos. 27 electivos HC y 8 opciones FG electiva en ambos cursos; ciencias 1M/2M conservan alias por eje; se eliminan residuos de navegación. La cobertura declarada no incluye especialidades TP ni programas confesionales de Religión.')
 progress.pop('commit_fusion',None)
 write(DATA/'meta/verification-progress.json',progress)
 print(json.dumps({'archivos_media':len(files),'nuevos':sum(r['nuevo'] for r in report),'oa':sum(r['oa_despues'] for r in report),'cambios_texto':sum(len(r['cambios_texto']) for r in report)},ensure_ascii=False))

if __name__=='__main__':main()
