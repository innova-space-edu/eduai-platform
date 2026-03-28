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
