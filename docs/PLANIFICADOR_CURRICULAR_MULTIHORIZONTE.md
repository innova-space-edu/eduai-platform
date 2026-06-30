# Planificador Curricular Multihorizonte

## Objetivo

Esta fase agrega una base de planificación más amplia para EduAI. El planificador deja de depender solamente de la planificación diaria y pasa a trabajar con cinco horizontes:

- Diaria
- Semanal
- Mensual
- Semestral
- Anual

La intención es que el docente pueda ingresar pocos datos generales —curso, asignatura, unidad, OA reales, actividad general y periodo— y EduAI genere una estructura útil para planificación básica, media, semestral y anual.

## Rutas agregadas

### Página nueva

```txt
/educador/planificador-curricular
```

Permite configurar:

- Nivel educativo: parvularia, básica o media.
- Curso/subnivel.
- Asignatura o núcleo.
- Horizonte: diaria, semanal, mensual, semestral o anual.
- Periodo: por ejemplo, primer semestre marzo-junio o segundo semestre julio-diciembre.
- Unidad/módulo desde base curricular local.
- OA reales desde la base del repositorio.
- Actividad general.
- Unidades declaradas por el docente.
- Evaluación esperada.
- Inclusión PIE/diversidad.
- Formato institucional.
- Puente hacia agente día.

### API nueva

```txt
POST /api/agents/planificador-curricular
```

Recibe una configuración curricular y genera una planificación alineada a los OA disponibles en la base local.

## Archivos modificados o agregados

```txt
lib/planificador-curriculum.ts
app/api/agents/planificador-curricular/route.ts
app/educador/planificador-curricular/page.tsx
docs/PLANIFICADOR_CURRICULAR_MULTIHORIZONTE.md
```

## Principio central

Los OA no se inventan. La planificación debe usar solamente los objetivos entregados desde la base curricular del proyecto.

Si no hay OA suficientes para una combinación de curso/asignatura/unidad, el agente debe decirlo claramente y construir una propuesta pedagógica general sin crear códigos oficiales falsos.

## Puente con agente día

Las planificaciones mensual, semestral y anual no deben desarrollar todas las clases completas. Deben dejar una bajada clara para que el agente diario pueda generar después:

- Clase diaria.
- Guía.
- Rúbrica.
- Ticket de salida.
- Actividad específica.
- Material complementario.

## Recomendación de integración posterior

En una siguiente fase conviene enlazar esta ruta desde:

```txt
/educador
/agentes
/creator-hub
```

También se puede agregar guardado directo en `saved_plannings` y exportación PDF/Word desde esta nueva página, reutilizando las funciones que ya existen en el planificador actual.
