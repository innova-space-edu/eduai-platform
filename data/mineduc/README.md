# Catálogo curricular MINEDUC

Enseñanza media se carga desde los archivos de `media/`, registrados mediante `lib/mineduc-media.generated.ts`. La revisión del 6 de noviembre de 2026 incluye 108 combinaciones de curso/asignatura y 815 apariciones de OA (550 códigos distintos), con 27 electivos HC y 8 opciones de formación general electiva disponibles en 3° y 4° medio.

Consultar [auditoría, alcance, fuentes y validación](../../docs/AUDITORIA_OA_MEDIA_20261106.md). La cobertura verificada de esta revisión corresponde a OA de contenido de formación general y HC; no incluye las especialidades TP ni programas confesionales.

```bash
npm run curriculum:media:rebuild
npm run test:curriculum
npm run test:curriculum:media
```

La reconstrucción reproduce copias oficiales archivadas; no descarga versiones nuevas. No editar manualmente el módulo generado. Cada objetivo conserva su código y su fuente. Los alias de Biología, Física y Química de 1°/2° medio mantienen los códigos de Ciencias Naturales.

---

# Parvularia multi-OA / multi-núcleo

Estos archivos dejan lista la base para planificaciones integradas de Educación Parvularia.

## Qué cambia
- Los OA de Parvularia ya no quedan amarrados a un solo núcleo.
- El selector puede mezclar OA de distintos núcleos y ámbitos dentro del mismo subnivel.
- Los OAT también pueden combinarse de forma transversal.
- Se recomienda usar: 1 OA principal + 1 o 2 OA complementarios + hasta 2 OAT.

## Archivos incluidos
- `lib/mineduc-oa.ts`
- `lib/planificador-curriculum.ts`
- `app/educador/page.tsx`
- `data/mineduc/parvularia/common/metadata.multi_oa.json`

## Cómo reemplazarlos
1. Copia `lib/mineduc-oa.ts` sobre tu archivo actual.
2. Copia `lib/planificador-curriculum.ts` sobre tu archivo actual.
3. Copia `app/educador/page.tsx` sobre tu archivo actual.
4. Usa `metadata.multi_oa.json` como referencia para documentar el modo integrado.

## Resultado esperado
- En Parvularia podrás seleccionar hasta 3 OA.
- Los OA podrán venir de diferentes núcleos o ámbitos.
- Podrás sumar hasta 2 OAT transversales.
- La tarjeta de cada OA mostrará `Ámbito · Núcleo`, para que no se mezclen sin contexto.

