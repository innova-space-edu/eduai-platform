"""Reproducible foundation corpus. 2,000 generated rows, NOT 2,000 independent tasks.
100 template families, group-disjoint 70/15/15. No user data, no official OA invented.
"""
from pathlib import Path
import hashlib, json, random, re
VERSION = 'eduai-foundation-v1'
WRAPPERS = [
'Instrucción de trabajo: {task}', 'Resuelve esta solicitud escolar: {task}',
'Para una actividad de aula necesito lo siguiente. {task}', 'Atiende esta petición respetando su formato: {task}',
'Tarea independiente para EDUAI: {task}', 'Considera esta situación y entrega lo solicitado. {task}',
'En un ejercicio de práctica se pide: {task}', 'Ayúdame con esta tarea concreta: {task}',
'El encargo para esta sesión es el siguiente: {task}', 'Sigue la consigna sin agregar información ajena: {task}',
'Quiero trabajar este caso en clase. {task}', 'Lee con atención la petición: {task}',
'Una actividad educativa requiere esta respuesta: {task}', 'Procesa el siguiente encargo de manera precisa. {task}',
'Esta es la solicitud que debes atender ahora: {task}', 'Para completar una ficha de trabajo: {task}',
'Necesito una respuesta ajustada a esta instrucción. {task}', 'Ejercicio autónomo, con todos los datos incluidos: {task}',
'Aplica las instrucciones de esta tarea: {task}', 'Entrega el resultado de este caso educativo. {task}'
]
SYSTEM = 'Eres EDUAI. Responde en español. Cumple el formato solicitado y no inventes datos ausentes.'
TOOLS = 'Herramientas disponibles: create_assessment (evaluación), plan_lesson (planificación), translate_text (traducción), summarize_text (resumen), explain_math (explicación matemática). Solo selecciona, no ejecutes. Devuelve solo JSON con tool, subject y questionCount; usa null si no corresponde.'
ACTIVITIES = [
 {'titulo':'Patrones con bloques grandes','nivel':'Medio Mayor','inicio':'Invitar a explorar bloques grandes y reconocer sus formas.','desarrollo':'Organizar pares de formas y proponer cómo continuar una secuencia.','cierre':'Mostrar las secuencias y explicar las elecciones.','recursos':['bloques grandes','superficie despejada'],'evaluacion':'Observar si continúa un patrón y comunica su decisión.'},
 {'titulo':'Sombras del patio','nivel':'Transición 1','inicio':'Buscar sombras de objetos en un espacio supervisado.','desarrollo':'Comparar la sombra de dos objetos y representar sus contornos.','cierre':'Compartir una observación sobre las diferencias encontradas.','recursos':['objetos grandes','tiza'],'evaluacion':'Registrar si compara al menos una característica de las sombras.'},
 {'titulo':'Sonidos y pausas','nivel':'Medio Menor','inicio':'Escuchar una secuencia breve de palmas.','desarrollo':'Alternar sonidos suaves y pausas mediante imitación y elección.','cierre':'Invitar a proponer un sonido de despedida.','recursos':['voz','espacio despejado'],'evaluacion':'Observar respuestas gestuales, corporales o vocales ante las pausas.'},
 {'titulo':'Relato compartido','nivel':'Transición 2','inicio':'Observar tres imágenes de situaciones cotidianas.','desarrollo':'Elegir un orden y construir un relato con apoyo de preguntas abiertas.','cierre':'Volver a narrar el relato acordado entre los participantes.','recursos':['tres imágenes grandes'],'evaluacion':'Registrar si aporta una idea y relaciona dos sucesos del relato.'},
 {'titulo':'Exploración de telas','nivel':'Sala Cuna Mayor','inicio':'Presentar telas limpias, amplias y sin partes desprendibles.','desarrollo':'Permitir tocar y desplazar telas bajo supervisión directa, siguiendo la iniciativa infantil.','cierre':'Anticipar el término y acompañar la entrega de los materiales.','recursos':['telas grandes limpias'],'evaluacion':'Observar gestos de interés, preferencias y formas de exploración.'}
]

def dumps(obj): return json.dumps(obj, ensure_ascii=False, separators=(',',':'))
def digest(obj): return hashlib.sha256(dumps(obj).encode()).hexdigest()
def row(category, family, variant, task, answer, expected, system=SYSTEM):
    return {'id':f'{category}-{family:02d}-{variant:02d}','family':f'{category}:wrapper-{family:02d}','category':category,
            'origin':'synthetic_programmatic','verification':'deterministic_reference',
            'messages':[{'role':'system','content':system},{'role':'user','content':WRAPPERS[family].format(task=task)},{'role':'assistant','content':answer}], 'expected':expected}

def build_rows():
    rows=[]
    for f in range(20):
        for op in range(5):
            for v in range(10):
                a=11+f*7+v*3; b=2+v; symbol=['+','-','*','/','='][op]
                if op==0: expression=f'{a} + {b}'; result=a+b; proof=f'{expression} = {result}'; question=f'Calcula la suma {expression}.'
                elif op==1: expression=f'{a} - {b}'; result=a-b; proof=f'{expression} = {result}'; question=f'Calcula la diferencia {expression}.'
                elif op==2: expression=f'{a} * {b}'; result=a*b; proof=f'{expression} = {result}'; question=f'Calcula el producto {expression}.'
                elif op==3: expression=f'{a*b} / {b}'; result=a; proof=f'{expression} = {result}'; question=f'Calcula la división exacta {expression}.'
                else: result=v+f+2; total=b*result+a; proof=f'x = ({total} - {a}) / {b} = {result}'; question=f'Resuelve para x: {b}x + {a} = {total}.'
                if v%2==0:
                    task=question+' Devuelve solo JSON con la clave resultado, como número entero.'; answer=dumps({'resultado':result}); expected={'kind':'json','value':{'resultado':result}}
                else:
                    task=question+' Responde con RESULTADO: número y después una línea PROCEDIMIENTO: con la igualdad que justifica el cálculo.'; answer=f'RESULTADO: {result}\nPROCEDIMIENTO: {proof}'; expected={'kind':'arithmetic_text','result':result,'proof':proof}
                rows.append(row('arithmetic',f,op*10+v,task,answer,expected))
        for tool_index, tool in enumerate(['create_assessment','plan_lesson','translate_text','summarize_text','explain_math']):
            for v,subject in enumerate(['Matemática','Lenguaje','Ciencias','Historia','Tecnología']):
                count=5+f+v
                tasks=[f'Prepara una evaluación de {subject} con {count} preguntas.',f'Planifica una clase de {subject}.',f'Traduce al inglés un texto de {subject}.',f'Resume un texto de {subject}.',f'Explica un procedimiento matemático usado en {subject}.']
                payload={'tool':tool,'subject':subject,'questionCount':count if tool_index==0 else None}
                rows.append(row('routing',f,tool_index*5+v,tasks[tool_index],dumps(payload),{'kind':'json','value':payload},TOOLS))
        for v in range(10):
            title=['Formas del entorno','Relatos breves','Medición de objetos','Cuidado del patio','Secuencias rítmicas'][v%5]+f' {f}-{v}'
            course=f'{1+(f+v)%8} básico'; minutes=20+5*v
            payload={'titulo':title,'curso':course,'minutos':minutes if v%3 else None}
            task=f'Extrae titulo, curso y minutos como JSON. Usa null para datos ausentes. Ficha: título «{title}»; curso «{course}»'+(f'; duración {minutes} minutos.' if v%3 else '. No se indicó duración.')
            rows.append(row('extraction',f,v,task,dumps(payload),{'kind':'json','value':payload}))
            code=f'PR-{f:02d}-{v:02d}'; goal=['comparar formas de objetos grandes','explicar una elección usando evidencias','identificar un patrón en una secuencia','representar una observación mediante dibujos','relacionar causas y consecuencias de una acción'][v%5]
            statement=f'El grupo puede {goal}.'
            task=f'Objetivo de práctica, NO oficial: código {code}; texto «{statement}». Cita únicamente código y texto exactos separados por dos puntos. No atribuyas este objetivo al MINEDUC.'
            answer=f'{code}: {statement}'
            rows.append(row('grounding',f,v,task,answer,{'kind':'exact_text','value':answer}))
        for v,activity in enumerate(ACTIVITIES):
            task='Convierte esta ficha a JSON conservando exactamente los siete campos y todos sus valores. No diseñes una actividad nueva. Ficha: '+dumps(activity)
            rows.append(row('activity_format',f,v,task,dumps(activity),{'kind':'json','value':activity}))
    assert len(rows)==2000
    return rows

def partition(rows):
    families={category:sorted({r['family'] for r in rows if r['category']==category},key=lambda value:hashlib.sha256((VERSION+value).encode()).hexdigest()) for category in sorted({r['category'] for r in rows})}
    assignment={family:('train' if i<14 else 'validation' if i<17 else 'test') for values in families.values() for i,family in enumerate(values)}
    splits={name:[r for r in rows if assignment[r['family']]==name] for name in ['train','validation','test']}
    for name,items in splits.items(): random.Random(8127).shuffle(items)
    validate(splits)
    return splits

def validate(splits):
    seen_prompts={}; seen_families={}; seen_ids=set()
    for split,rows in splits.items():
        for r in rows:
            if r['id'] in seen_ids: raise ValueError('Duplicate id')
            seen_ids.add(r['id'])
            prompt=re.sub(r'\s+',' ',r['messages'][1]['content'].casefold()).strip()
            if prompt in seen_prompts: raise ValueError('Duplicate prompt')
            seen_prompts[prompt]=split
            if r['family'] in seen_families and seen_families[r['family']]!=split: raise ValueError('Family leakage')
            seen_families[r['family']]=split
            if not grade(r['messages'][-1]['content'],r['expected']): raise ValueError('Invalid reference '+r['id'])
    return True

def grade(text, expected):
    if expected['kind']=='json':
        # Strict output contract; prose or markdown around JSON does not pass.
        try: value=json.loads(text.strip())
        except (ValueError,TypeError): return False
        def typed_equal(a,b):
            if type(a) is not type(b): return False
            if isinstance(a,dict): return a.keys()==b.keys() and all(typed_equal(a[k],b[k]) for k in a)
            if isinstance(a,list): return len(a)==len(b) and all(typed_equal(x,y) for x,y in zip(a,b))
            return a==b
        return typed_equal(value,expected['value'])
    if expected['kind']=='exact_text': return text.strip()==expected['value']
    if expected['kind']=='arithmetic_text':
        match=re.search(r'^RESULTADO:[ \t]*(-?\d+)[ \t]*$',text,re.I|re.M)
        return bool(match and int(match.group(1))==expected['result'] and re.sub(r'\s+','',expected['proof']).replace('*','×').replace('/','÷') in re.sub(r'\s+','',text).replace('*','×').replace('/','÷'))
    raise ValueError('Unknown oracle')

def build(output):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    splits=partition(build_rows())
    manifest={'version':VERSION,'scope':'synthetic_foundation_not_pedagogical_validation','counts':{},'families':{},'files':{},'testPolicy':'sealed_final_no_tuning','productionReady':False}
    for name,rows in splits.items():
        data=''.join(dumps(r)+'\n' for r in rows)
        path=output/(name+'.jsonl');path.write_text(data,encoding='utf-8')
        manifest['counts'][name]=len(rows);manifest['families'][name]=len({r['family'] for r in rows});manifest['files'][path.name]=hashlib.sha256(data.encode()).hexdigest()
    manifest['datasetId']=digest(manifest)
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    return manifest
if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);args=p.parse_args();print(json.dumps(build(args.output),indent=2))
