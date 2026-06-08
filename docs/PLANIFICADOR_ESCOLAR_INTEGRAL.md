# Planificador escolar integral conectado a OA

## Objetivo

El agente APl ahora puede planificar situaciones escolares diversas sin tratarlas como una clase tradicional. La misma pantalla permite trabajar con clases, proyectos ABP/STEAM, ferias científicas, eventos escolares, talleres, campañas, salidas pedagógicas y experiencias de educación parvularia.

## Flujo conectado

1. El docente selecciona nivel, curso, asignatura o núcleo, unidad, OA y OAT cuando corresponda.
2. El selector **Tipo de planificación escolar** permite elegir un perfil o usar detección automática.
3. El backend clasifica la solicitud mediante `lib/school-planning-profiles.ts`.
4. `lib/planner-oa-bridge.ts` consulta los OA de `data/mineduc` usando el mismo nivel, curso, asignatura y unidad.
5. Si el docente eligió OA manualmente, esa selección tiene prioridad absoluta.
6. Si no eligió OA, el puente curricular propone OA relevantes por coincidencia contextual y los entrega al prompt como respaldo oficial local.
7. El agente genera la planificación según el perfil escolar detectado.
8. El auditor comprueba que la salida contenga los componentes esenciales del perfil. Si faltan componentes, el backend solicita una segunda versión correctiva.

## Perfiles disponibles

- Clase curricular
- Proyecto ABP / STEAM
- Feria científica
- Evento escolar
- Taller práctico
- Campaña escolar
- Salida pedagógica
- Experiencia parvularia

## Endpoint de diagnóstico curricular

Ruta autenticada:

```text
GET /api/agents/educador/curriculum?nivel=media&curso=2%C2%B0%20Medio&asignatura=Matem%C3%A1tica
```

Entrega asignaturas, unidades, OA y resumen de cobertura desde `data/mineduc`.

## Prueba local

```bash
npm install
npm run test:planner
npx tsc --noEmit
npx eslint app/layout.tsx app/api/agents/educador/route.ts app/api/agents/educador/curriculum/route.ts app/educador/page.tsx lib/school-planning-profiles.ts lib/planner-oa-bridge.ts
```

## Archivos principales

- `app/educador/page.tsx`
- `app/api/agents/educador/route.ts`
- `app/api/agents/educador/curriculum/route.ts`
- `lib/school-planning-profiles.ts`
- `lib/planner-oa-bridge.ts`
- `data/mineduc/**`
