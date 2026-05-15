# EduAI Platform DESIGN.md

## Propósito
EduAI Platform debe sentirse como un sistema educativo moderno, confiable y amable: mezcla de ChatGPT, Spotify, Canva educativo y panel institucional. Todas las nuevas pantallas deben mantener continuidad visual, accesibilidad PIE/NEE y claridad para estudiantes/docentes.

## Principios visuales
- AI-first: cada pantalla debe mostrar claramente qué puede hacer la IA y qué acción sigue.
- Menos botones visibles: usar tabs, menús desplegables, sidebars y paneles progresivos.
- Accesibilidad real: alto contraste cuando corresponda, espaciado generoso, lectura cómoda y foco visible.
- Estilo Canva educativo: tarjetas limpias, badges, colores suaves, sombras sutiles y layouts aireados.
- Modo institucional: datos, seguridad, auditoría y exámenes deben verse serios, no como demo.

## Paleta base
- `brand.primary`: #2563EB — acciones principales, enlaces, foco docente.
- `brand.ai`: #7C3AED — IA, Claw, generación, razonamiento.
- `brand.success`: #10B981 — completado, correcto, música/focus.
- `brand.warning`: #F59E0B — advertencias, seguridad media.
- `brand.danger`: #EF4444 — entregar examen, bloqueo, riesgo alto.
- `surface.app`: #F8FAFC — fondo claro general.
- `surface.card`: #FFFFFF — tarjetas principales.
- `surface.soft`: #F1F5F9 — paneles secundarios.
- `text.main`: #0F172A — títulos y contenido principal.
- `text.sub`: #475569 — contenido secundario.
- `text.muted`: #94A3B8 — metadatos.

## Modo oscuro / media
Para módulos multimedia como Music Studio o Video Studio usar fondo profundo:
- `media.bg`: #050B08
- `media.panel`: #07120D
- `media.accent`: #1DB954
- `media.text`: #FFFFFF

## Tipografía
- General: Inter.
- Accesibilidad PIE/NEE: Lexend o Atkinson Hyperlegible.
- Títulos creativos: Poppins opcional.
- Código: fuente monoespaciada del sistema.

## Componentes
### Botones
- Primario: fondo sólido, rounded-2xl/full, texto bold.
- Secundario: borde suave, fondo translúcido, hover claro.
- Peligro: rojo solo para acciones irreversibles.
- Evitar grupos grandes de botones visibles; preferir tabs o dropdown.

### Cards
- `rounded-[24px]` o `rounded-2xl`.
- `border border-soft`.
- Sombra suave solo cuando el card flota.
- Cards importantes deben tener encabezado, descripción corta y CTA claro.

### Formularios
- Inputs grandes, bordes redondeados, labels en uppercase pequeño.
- Agrupar configuraciones avanzadas en acordeones.
- Mostrar resumen visual de la configuración antes de expandir.

### Chat global
- Layout tipo ChatGPT: sidebar izquierda, conversación central, panel contextual opcional a la derecha.
- Mensajes del usuario a la derecha, IA a la izquierda.
- Mostrar herramientas usadas con cards pequeñas, no texto técnico largo.

### Music Studio
- Inspiración Spotify/OpenSpot: sidebar biblioteca, hero playlist, lista de canciones, cola, now-playing bar persistente.
- Debe mantener reproducción al navegar y permitir pausar manualmente.

### Exámenes
- Creador docente: pasos progresivos, configuración visual resumida, IA como asistente lateral.
- Estudiante: una pregunta clara por pantalla, navegación limpia, timer visible sin invadir, botón entregar solo al final.
- PIE/NEE: botones más grandes, ancho de lectura moderado y lenguaje claro.

## Seguridad y roles
- Cualquier modelo “sin censura” o experimental debe estar aislado en Admin Lab.
- Nunca debe estar disponible para estudiantes o usuarios generales.
- Debe requerir rol admin/super_admin, auditoría y avisos de uso responsable.

## Reglas para agentes que editan código
- No reemplazar archivos completos si basta con componente nuevo.
- No duplicar rutas de agentes; usar SuperAgent como puerta global.
- Mantener fallback si una API falla.
- Evitar dependencias pesadas sin justificar.
