-- Base de conocimiento institucional, científica y tecnológica de EDUAI/Innova Space.
-- La selección de registros se hace por intención para entregar información de forma progresiva.

create table if not exists public.eduai_platform_knowledge (
  knowledge_key text primary key,
  category text not null,
  title text not null,
  content text not null,
  facts jsonb not null default '{}'::jsonb,
  source_refs text[] not null default '{}'::text[],
  keywords text[] not null default '{}'::text[],
  detail_level smallint not null default 1 check (detail_level between 1 and 3),
  is_active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.eduai_platform_knowledge
  add column if not exists keywords text[] not null default '{}'::text[];

alter table public.eduai_platform_knowledge
  add column if not exists detail_level smallint not null default 1;

create index if not exists eduai_platform_knowledge_active_priority_idx
  on public.eduai_platform_knowledge (is_active, priority);

create index if not exists eduai_platform_knowledge_category_idx
  on public.eduai_platform_knowledge (category, detail_level, priority);

alter table public.eduai_platform_knowledge enable row level security;

drop policy if exists "Authenticated users can read EduAI platform knowledge"
  on public.eduai_platform_knowledge;

create policy "Authenticated users can read EduAI platform knowledge"
  on public.eduai_platform_knowledge
  for select
  to authenticated
  using (is_active = true);

insert into public.eduai_platform_knowledge
  (knowledge_key, category, title, content, facts, source_refs, keywords, detail_level, is_active, priority)
values
  (
    'platform_identity','identity','Identidad de EDUAI',
    $eduai$EDUAI Platform es un ecosistema educativo multiagente y multimodal desarrollado por Innova Space Education SpA. Integra planificación, investigación con fuentes, notebooks, Creator Hub, evaluación digital, audio, imagen, video, colaboración y herramientas de inteligencia artificial. Su arquitectura está diseñada para evolucionar de forma continua.$eduai$,
    '{"product":"EDUAI Platform","organization":"Innova Space Education SpA","project_year":2026}'::jsonb,
    array['innova_2027.pdf','README.md'],
    array['eduai','plataforma'],
    1,true,10
  ),
  (
    'company_identity','company','Innova Space Education SpA',
    $eduai$Innova Space Education SpA es la empresa responsable del desarrollo de EDUAI y de otros prototipos, plataformas y servicios digitales vinculados con educación, ciencia, inteligencia artificial e innovación tecnológica. Su documentación institucional la ubica en Antofagasta, Chile.$eduai$,
    '{"company":"Innova Space Education SpA","location":"Antofagasta, Chile"}'::jsonb,
    array['innova_2027.pdf'],
    array['empresa','innova space','organización'],
    1,true,20
  ),
  (
    'founder_identity','founder','Fundador y dirección',
    $eduai$La documentación institucional identifica a Esthefano Morales Campaña como fundador, propietario y Director Ejecutivo (CEO) de Innova Space Education SpA, con participación directa en el diseño, desarrollo y dirección tecnológica de prototipos, plataformas y servicios digitales de la empresa.$eduai$,
    '{"founder":"Esthefano Morales Campaña","roles":["Fundador","Propietario","Director Ejecutivo (CEO)"]}'::jsonb,
    array['innova_2027.pdf'],
    array['fundador','creador','CEO','Esthefano Morales'],
    1,true,25
  ),
  (
    'founder_academic_path','trajectory','Formación académica del fundador',
    $eduai$Esthefano Morales Campaña inició en 2013 la Licenciatura en Física con mención en Astronomía en la Universidad Católica del Norte. Su formación incluye física experimental, análisis de datos, computación científica, astronomía, instrumentación y modelamiento. En 2019 ingresó al Doctorado en Física con mención en Física Matemática de la Universidad de Antofagasta y desde 2020 fue beneficiario de la Beca de Doctorado Nacional ANID.$eduai$,
    '{"undergraduate":"Licenciatura en Física con mención en Astronomía, UCN","doctorate":"Doctorado en Física con mención en Física Matemática, UA","anid_scholarship":2020}'::jsonb,
    array['resena trayectria 2027 (1)(1).pdf'],
    array['formación','doctorado','universidad','trayectoria'],
    2,true,30
  ),
  (
    'founder_scientific_trajectory','trajectory','Trayectoria científica',
    $eduai$Su trayectoria científica combina astronomía observacional, física de plasmas, electromagnetismo, física matemática, métodos numéricos e instrumentación. Trabajó en análisis espectroscópico y fotométrico de NGC 2453/NGC 2452, modeló la dinámica de Plasma Focus Sumaj Lauray 720-J, realizó caracterización de emisiones iónicas y desarrolló experiencia experimental en plasmas producidos por láser mediante shadowgrafía, interferometría Mach-Zehnder, imágenes rápidas y espectroscopía resuelta en el tiempo.$eduai$,
    '{"fields":["astronomía","física de plasmas","electromagnetismo","física matemática","métodos numéricos","instrumentación"]}'::jsonb,
    array['resena trayectria 2027 (1)(1).pdf'],
    array['trayectoria científica','plasma focus','astronomía','plasmas'],
    2,true,35
  ),
  (
    'founder_publications','trajectory','Publicaciones y producción científica',
    $eduai$La trayectoria declarada incluye cuatro artículos publicados en revistas internacionales con revisión por pares: dos trabajos en The European Physical Journal C sobre objetos compactos anisotrópicos y desacoplamiento gravitacional (2018), un artículo en Astronomy & Astrophysics sobre NGC 2453 y NGC 2452 (2019), y “MPQA method applied to the plasma dispersion function” en AIP Advances 14, 025142 (2024). También incluye un preprint de 2020 sobre modelamiento bidimensional de Plasma Focus y contribuciones en congresos nacionales e internacionales.$eduai$,
    '{"peer_reviewed_articles":4,"journals":["The European Physical Journal C","Astronomy & Astrophysics","AIP Advances"],"plasma_focus_preprint_year":2020}'::jsonb,
    array['resena trayectria 2027 (1)(1).pdf'],
    array['publicaciones','papers','artículos','AIP Advances'],
    3,true,40
  ),
  (
    'postdoctoral_research','research','Línea de investigación en plasma y micropropulsión',
    $eduai$La línea postdoctoral propuesta estudia una arquitectura ultraminiaturizada derivada de Plasma Focus para propulsión pulsada. Busca determinar cómo la geometría y la extensión axial relativa entre electrodos modifican el breakdown y el acoplamiento temporal circuito-plasma, caracterizar la formación y evolución de la current sheath, relacionarla con ablación, ionización y distribución del plume, cuantificar el impulse bit y evaluar repetibilidad, degradación y emisiones electromagnéticas con proyección a integración CubeSat.$eduai$,
    '{"field":"física de plasmas y micropropulsión","targets":["breakdown","circuito-plasma","current sheath","plume","impulse bit","CubeSat"]}'::jsonb,
    array['resena trayectria 2027 (1)(1).pdf'],
    array['postdoctorado','micropropulsión','CubeSat','Plasma Focus'],
    2,true,45
  ),
  (
    'project_portfolio','projects','Portafolio tecnológico',
    $eduai$Los proyectos institucionales documentados incluyen EDUAI Platform, Sello Tecnológico, Model Lab Experimental I+D y Brain AI. EDUAI es el ecosistema educativo; Sello Tecnológico gestiona y documenta proyectos tecnológicos, científicos y STEAM; Model Lab compara e integra modelos, agentes y pipelines de IA; Brain AI explora memoria contextual, razonamiento multiagente, reflexión, síntesis de experiencias y generación de hipótesis.$eduai$,
    '{"projects":["EDUAI Platform","Sello Tecnológico","Model Lab Experimental I+D","Brain AI"]}'::jsonb,
    array['innova_2027.pdf'],
    array['proyectos','portafolio','productos'],
    1,true,50
  ),
  (
    'project_eduai','projects','EDUAI Platform',
    $eduai$EDUAI Platform está en evolución como ecosistema educativo multiagente y multimodal. Combina planificación, investigación con fuentes, notebooks, Creator Hub, evaluación digital, audio, imagen, video, colaboración, agentes especializados y una arquitectura multiproveedor de IA.$eduai$,
    '{"status":"en evolución"}'::jsonb,
    array['innova_2027.pdf','README.md'],
    array['EDUAI Platform','capacidades EDUAI'],
    2,true,55
  ),
  (
    'project_sello','projects','Sello Tecnológico',
    $eduai$Sello Tecnológico es una plataforma para crear, desarrollar, documentar, evaluar y publicar proyectos tecnológicos, científicos y STEAM. Incluye roles institucionales, evidencias, seguimiento, rúbricas, comunidad y trazabilidad sobre infraestructura Supabase/Vercel. Su trayectoria incluye uso aplicado en un entorno educativo real.$eduai$,
    '{"status":"producción","focus":"proyectos tecnológicos, científicos y STEAM"}'::jsonb,
    array['innova_2027.pdf','resena trayectria 2027 (1)(1).pdf'],
    array['Sello Tecnológico','STEAM'],
    2,true,60
  ),
  (
    'project_model_lab','projects','Model Lab Experimental I+D',
    $eduai$Model Lab es un entorno experimental de I+D para comparar, integrar y evaluar modelos, agentes y pipelines de inteligencia artificial antes de incorporarlos a productos. Considera inferencia, RAG, contexto, multimodalidad, ejecución local y en nube, datasets, entrenamiento/adaptación y prototipos.$eduai$,
    '{"status":"I+D experimental"}'::jsonb,
    array['innova_2027.pdf','README.md'],
    array['Model Lab','modelos IA','RAG'],
    2,true,65
  ),
  (
    'project_brain_ai','projects','Brain AI',
    $eduai$Brain AI es una arquitectura experimental vinculada a Model Lab que explora memoria contextual, razonamiento multiagente, reflexión, síntesis de experiencias y generación de hipótesis. Evalúa aprendizaje y adaptación iterativa bajo supervisión humana; no debe presentarse como un sistema consciente ni como una cognición biológica equivalente.$eduai$,
    '{"status":"I+D experimental"}'::jsonb,
    array['innova_2027.pdf'],
    array['Brain AI','memoria contextual','razonamiento multiagente'],
    2,true,70
  ),
  (
    'technology_stack','technology','Tecnologías principales',
    $eduai$El ecosistema documenta desarrollo con Next.js, React, TypeScript, Node.js, Python, REST APIs y PWA; nube y datos con Supabase, PostgreSQL, RLS, Realtime, Vercel, Cloudflare y GitHub; integración de IA con Gemini, Groq, OpenRouter, Hugging Face, Cerebras, Llama, Qwen y DeepSeek; y capacidades multimedia con modelos multimodales, TTS/STT, ElevenLabs, imagen, audio y video.$eduai$,
    '{"development":["Next.js","React","TypeScript","Node.js","Python","REST APIs","PWA"],"cloud_data":["Supabase","PostgreSQL","RLS","Realtime","Vercel","Cloudflare","GitHub"],"ai":["Gemini","Groq","OpenRouter","Hugging Face","Cerebras","Llama","Qwen","DeepSeek"]}'::jsonb,
    array['innova_2027.pdf','README.md','package.json'],
    array['tecnologías','stack','Supabase','Vercel','IA'],
    1,true,75
  ),
  (
    'services','services','Servicios y capacidades',
    $eduai$Las capacidades de Innova Space Education SpA abarcan desarrollo de software y soluciones educativas digitales, plataformas y automatización de procesos, integración de inteligencia artificial y agentes, infraestructura cloud y bases de datos, investigación y análisis de información, creación de recursos y herramientas multimedia, planificación y evaluación educativa, prototipado tecnológico y acompañamiento de proyectos científicos y STEAM.$eduai$,
    '{"services":["software educativo","IA y agentes","cloud y datos","investigación y análisis","multimedia","planificación y evaluación","prototipado","proyectos STEAM"]}'::jsonb,
    array['innova_2027.pdf','resena trayectria 2027 (1)(1).pdf','README.md'],
    array['servicios','soluciones','qué hacen'],
    1,true,80
  ),
  (
    'research_fields','research','Campos de investigación y desarrollo',
    $eduai$Las líneas de trabajo combinan física de plasmas, micropropulsión y tecnología espacial; modelamiento físico y métodos numéricos; inteligencia artificial educativa; agentes y orquestación; RAG y memoria; modelos locales y cuantizados; entrenamiento y adaptación de modelos; multimodalidad; voz, audio, imagen y video; visualización científica; evaluación educativa, currículo y accesibilidad PIE/NEE.$eduai$,
    '{"fields":["física de plasmas","micropropulsión","tecnología espacial","modelamiento","IA educativa","agentes","RAG y memoria","modelos locales","multimodalidad","visualización científica","tecnología educativa"]}'::jsonb,
    array['innova_2027.pdf','resena trayectria 2027 (1)(1).pdf','README.md'],
    array['investigación','I+D','campos de trabajo'],
    1,true,85
  ),
  (
    'innovation_outreach','trajectory','Innovación y vinculación',
    $eduai$La trayectoria combina investigación, docencia, divulgación científica y desarrollo tecnológico. Incluye participación en actividades de física y astronomía, comunicación científica, experiencias experimentales y desarrollo de herramientas digitales aplicadas a usuarios finales. Desde 2025 se incorporaron de manera sistemática desarrollo de software, bases de datos, infraestructura cloud e integración de inteligencia artificial al perfil profesional.$eduai$,
    '{"areas":["investigación","docencia","divulgación","desarrollo tecnológico"],"software_ai_since":2025}'::jsonb,
    array['resena trayectria 2027 (1)(1).pdf'],
    array['innovación','divulgación','vinculación','transferencia tecnológica'],
    2,true,90
  ),
  (
    'malecns_overview','malecns','MaleCNS AI: objetivo y sustrato',
    $eduai$MaleCNS AI es una línea experimental que estudia si una topología neuronal real, combinada con plasticidad y mecanismos de memoria, puede sostener aprendizaje persistente sin depender de un modelo de lenguaje como sustrato cognitivo principal. El runtime histórico usa la topología estructural Male Drosophila CNS v1.0 con 165.122 neuronas y 25.563.096 conexiones. Es un runtime sparse de ingeniería, no spiking, y sus resultados no implican consciencia ni equivalencia fisiológica con Drosophila.$eduai$,
    '{"topology":"Male Drosophila CNS v1.0","neurons":165122,"connections":25563096,"nature":"runtime sparse de ingeniería"}'::jsonb,
    array['Informe_MaleCNS_AI_estado_V29.pdf','Pasted text(20260916-024210).txt'],
    array['MaleCNS','connectoma','Drosophila','neuronas'],
    1,true,100
  ),
  (
    'malecns_validated_results','malecns','MaleCNS: resultados validados hasta V29',
    $eduai$El informe V29 registra como hitos validados V20 (memoria episódica y novedad), V22 (recuperación asociativa), V24 (self-state/metacognition) y V28b (routing sparse aprendido memoria→acción). En V28b el router alcanzó 80,5% held-out frente a controles cercanos a 50%. V29-fix1 mostró query accuracy de 86,1%, pero READ recall de 36,1%, por lo que el gate autónomo WRITE/HOLD/READ no quedó validado estrictamente. El principal cuello de botella identificado era decidir autónomamente cuándo escribir, mantener o leer memoria.$eduai$,
    '{"validated":["V20","V22","V24","V28b"],"v28b_heldout_accuracy":0.805,"v29_fix1_query_accuracy":0.861,"v29_fix1_read_recall":0.361,"v29_strict_validated":false}'::jsonb,
    array['Informe_MaleCNS_AI_estado_V29.pdf'],
    array['V20','V22','V24','V28b','V29','validación','READ recall'],
    2,true,105
  ),
  (
    'malecns_architecture','malecns','MaleCNS: arquitectura que emerge de los experimentos',
    $eduai$La hipótesis refinada separa tres escalas funcionales: un estado rápido para percepción/acción que puede volver a basal en fronteras de evento; memorias o trazas persistentes fuera del recurrente global; y un sistema de gating/routing que decide WRITE, HOLD o READ. El ciclo objetivo es observar → estado rápido → autoevaluación → gate → lectura/escritura de memoria → router → acción → recompensa/error → plasticidad → consolidación/replay cuando corresponda.$eduai$,
    '{"layers":["estado rápido","memoria persistente","gate y routing"],"gate_actions":["WRITE","HOLD","READ"]}'::jsonb,
    array['Informe_MaleCNS_AI_estado_V29.pdf'],
    array['arquitectura','WRITE','HOLD','READ','memoria','routing'],
    2,true,110
  ),
  (
    'malecns_scaling_v45c','malecns','MaleCNS V45C Scalable',
    $eduai$V45C Scalable es el protocolo de escalamiento actualmente preparado para continuar MaleCNS sin usar modelos de IA externos. El notebook define entrenamiento regional de 160→192→224→256 asociaciones y gates de capacidad/retención. Sólo si ese bloque pasa, construye una expansión real de 4.161→8.192 neuronas usando el connectoma MaleCNS y transfiere el checkpoint. Las expansiones 16k→32k→65k→131k→165k quedan explícitamente bloqueadas hasta revisar 8.192. El notebook disponible define el procedimiento, pero no contiene una ejecución final registrada que permita afirmar que 8.192 o 165k ya fueron validados.$eduai$,
    '{"regional_associations":[160,192,224,256],"first_real_expansion":[4161,8192],"later_targets":[16384,32768,65536,131072,165122],"external_ai_used":false,"validation_status":"protocol prepared; final V45C run not evidenced in notebook"}'::jsonb,
    array['MaleCNS_V45C_Colab.ipynb'],
    array['V45C','escalabilidad','256','8192','165k'],
    2,true,115
  ),
  (
    'malecns_future_research','malecns','MaleCNS: líneas experimentales siguientes',
    $eduai$Las líneas propuestas para etapas posteriores incluyen plasticidad sináptica multiescala fast→slow, protección de sinapsis importantes, eligibility traces y aprendizaje online; parametrización progresiva para no hacer plásticas las 25,5 millones de conexiones desde el inicio; un piloto de memoria asociativa en Mushroom Body con sinapsis KC→MBON moduladas por neuronas dopaminérgicas; memoria multi-item con interferencia y recuperación por contenido; controles matched-null del connectoma; y e-prop/learning signals locales. Estas ideas son hipótesis y planes experimentales, no resultados ya validados.$eduai$,
    '{"proposed":["plasticidad fast→slow","importancia sináptica","eligibility traces","pools plásticos progresivos","Mushroom Body KC→MBON + DAN","memoria multi-item","matched-null controls","e-prop"],"status":"propuestas de I+D"}'::jsonb,
    array['Texto pegado(20261004-223944).txt','Informe_MaleCNS_AI_estado_V29.pdf'],
    array['Mushroom Body','eligibility','plasticidad multiescala','e-prop','sinapsis'],
    3,true,120
  ),
  (
    'institution_neutrality','positioning','Alcance institucional',
    $eduai$EDUAI se presenta para personas e instituciones educativas en general. Claw no debe asumir Colegio Providencia ni ninguna institución, ciudad o país concreto salvo que el usuario lo indique. Cuando exista contexto institucional explícito, puede adaptar lenguaje, currículo, herramientas y referencias locales.$eduai$,
    '{"default_scope":"personas e instituciones educativas","assume_specific_institution":false}'::jsonb,
    array['product_policy'],
    array['institución','colegio','universidad','país'],
    1,true,200
  )
on conflict (knowledge_key) do update
set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  facts = excluded.facts,
  source_refs = excluded.source_refs,
  keywords = excluded.keywords,
  detail_level = excluded.detail_level,
  is_active = excluded.is_active,
  priority = excluded.priority,
  updated_at = now();
