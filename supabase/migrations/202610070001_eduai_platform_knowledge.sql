-- Conocimiento institucional y técnico de EDUAI para Claw/RAG ligero.
-- Se mantiene versionado en el repositorio y se consulta solo cuando la conversación
-- pregunta por EDUAI, Innova Space, tecnologías, proyectos, investigación o servicios.

create table if not exists public.eduai_platform_knowledge (
  knowledge_key text primary key,
  category text not null,
  title text not null,
  content text not null,
  facts jsonb not null default '{}'::jsonb,
  source_refs text[] not null default '{}'::text[],
  is_active boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eduai_platform_knowledge_active_priority_idx
  on public.eduai_platform_knowledge (is_active, priority);

alter table public.eduai_platform_knowledge enable row level security;

drop policy if exists "Authenticated users can read EduAI platform knowledge"
  on public.eduai_platform_knowledge;

create policy "Authenticated users can read EduAI platform knowledge"
  on public.eduai_platform_knowledge
  for select
  to authenticated
  using (is_active = true);

insert into public.eduai_platform_knowledge
  (knowledge_key, category, title, content, facts, source_refs, is_active, priority)
values
  (
    'platform_identity',
    'identity',
    'Identidad de EDUAI',
    $eduai$EDUAI Platform es un ecosistema educativo desarrollado por Innova Space Education SpA. La documentación vigente del repositorio identifica 2026 como año del proyecto y usa el dominio eduai.innova-space-edu.cl.$eduai$,
    '{"product":"EDUAI Platform","organization":"Innova Space Education SpA","year":2026,"domain":"eduai.innova-space-edu.cl"}'::jsonb,
    array['README.md','LICENSE'],
    true,
    10
  ),
  (
    'creator_and_company',
    'company',
    'Organización creadora',
    $eduai$La organización desarrolladora y responsable documentada del proyecto es Innova Space Education SpA. El repositorio no registra de forma verificable el nombre de una persona creadora individual, por lo que Claw no debe inventarlo. Ese dato puede incorporarse cuando exista un registro oficial dentro de la base.$eduai$,
    '{"creator_organization":"Innova Space Education SpA","creator_person":null,"creator_person_status":"pendiente_de_registro_verificado"}'::jsonb,
    array['README.md','LICENSE'],
    true,
    20
  ),
  (
    'technology_stack',
    'technology',
    'Tecnologías principales',
    $eduai$El stack documentado incluye Next.js 16.3.5, React 19.2.3, TypeScript 5, Node.js 22, Supabase/PostgreSQL, Tailwind CSS 4 y despliegue web en Vercel. El ecosistema también integra un gateway multiproveedor de IA, Groq/Whisper para audio, APIs de Google/Gemini y un runtime local experimental basado en GGUF/wllama.$eduai$,
    '{"frontend":["Next.js 16.3.5","React 19.2.3","TypeScript 5","Tailwind CSS 4"],"backend":["Node.js 22","Supabase","PostgreSQL"],"deployment":["Vercel"],"ai":["EduAI AI Gateway","Groq","Whisper","Google Gemini"],"local_ai":["GGUF","wllama","RAG local"]}'::jsonb,
    array['README.md','package.json','training/eduai-local/README.md'],
    true,
    30
  ),
  (
    'product_portfolio',
    'projects',
    'Proyectos y líneas del ecosistema',
    $eduai$El repositorio documenta EDUAI Platform y líneas internas como Claw/Open EDUAI Work, Creator Hub, Image Studio, Video Studio, Audio Lab, planificación y evaluación, biblioteca/repositorio, EduAI Local/Model Factory y la integración Visual Design Skills. Deben describirse como productos, módulos o líneas del ecosistema; no como empresas separadas.$eduai$,
    '{"projects":["EDUAI Platform","Claw / Open EDUAI Work","Creator Hub","Image Studio","Video Studio","Audio Lab","EduAI Local / Model Factory","Visual Design Skills integration"]}'::jsonb,
    array['README.md','package.json'],
    true,
    40
  ),
  (
    'research_fields',
    'research',
    'Investigación y campos de trabajo',
    $eduai$Las líneas técnicas y de investigación representadas en el repositorio incluyen inteligencia artificial educativa, agentes y orquestación, RAG y recuperación de conocimiento, modelos locales y cuantizados, LoRA/QLoRA, generación multimodal, análisis de documentos, voz y audio, evaluación educativa, currículo, accesibilidad PIE/NEE y herramientas visuales/científicas.$eduai$,
    '{"fields":["IA educativa","agentes y orquestación","RAG","modelos locales y cuantización","LoRA/QLoRA","multimodalidad","análisis documental","voz y audio","evaluación educativa","currículo","accesibilidad PIE/NEE","visualización científica"]}'::jsonb,
    array['README.md','training/eduai-local/README.md'],
    true,
    50
  ),
  (
    'services',
    'services',
    'Servicios y capacidades',
    $eduai$Las capacidades y servicios documentados por el ecosistema abarcan desarrollo de soluciones educativas digitales, planificación y apoyo curricular, creación de evaluaciones, generación de materiales, integración de IA y agentes, investigación y análisis documental, contenido multimedia, audio/voz, repositorios y espacios de trabajo, colaboración y automatización de flujos educativos.$eduai$,
    '{"services":["desarrollo de soluciones educativas digitales","planificación y apoyo curricular","evaluaciones y rúbricas","creación de materiales","integración de IA y agentes","investigación y análisis documental","multimedia, audio y voz","repositorios y espacios de trabajo","automatización de flujos educativos"]}'::jsonb,
    array['README.md'],
    true,
    60
  ),
  (
    'institution_neutrality',
    'positioning',
    'Alcance institucional',
    $eduai$EDUAI debe presentarse de forma general para personas e instituciones educativas. Claw no debe asumir Colegio Providencia ni ninguna institución concreta salvo que el usuario la indique explícitamente. Cuando corresponda, debe adaptar lenguaje, currículo y contexto a la institución o país informado por la persona.$eduai$,
    '{"default_scope":"instituciones educativas en general","assume_specific_institution":false}'::jsonb,
    array['product_policy'],
    true,
    70
  )
on conflict (knowledge_key) do update
set
  category = excluded.category,
  title = excluded.title,
  content = excluded.content,
  facts = excluded.facts,
  source_refs = excluded.source_refs,
  is_active = excluded.is_active,
  priority = excluded.priority,
  updated_at = now();
