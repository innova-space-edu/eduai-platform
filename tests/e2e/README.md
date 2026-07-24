# Pruebas E2E del ciclo de examen

Estas pruebas recorren la aplicación como lo haría un usuario real:

1. un docente inicia sesión;
2. crea, guarda y publica un examen;
3. un estudiante ingresa mediante el código;
4. responde y entrega;
5. el docente revisa la entrega en resultados.

## Seguridad

Las pruebas son **manuales** y no forman parte de `npm run build`, del despliegue normal de Vercel ni del flujo productivo.

`playwright.config.mjs` bloquea por defecto la URL:

```text
https://eduaiplatformclon.vercel.app
```

El workflow de GitHub Actions también rechaza esa dirección. Utiliza:

- localhost;
- un proyecto o branch de Supabase para pruebas;
- un despliegue Vercel Preview;
- cuentas creadas exclusivamente para E2E.

No uses estudiantes reales, notas reales, RUT reales ni información PIE/NEE.

## Ejecución local

Instala Playwright temporalmente:

```bash
npm install --no-save --package-lock=false @playwright/test@1.61.1
npx playwright install chromium
```

Configura las variables en la terminal:

```bash
export E2E_BASE_URL=http://127.0.0.1:3000
export E2E_TEACHER_EMAIL=docente-e2e@ejemplo.cl
export E2E_TEACHER_PASSWORD='contraseña-de-prueba'
export E2E_STUDENT_NAME='Estudiante E2E'
export E2E_STUDENT_RUT='11111111-1'
```

Luego ejecuta:

```bash
npx playwright test --config=playwright.config.mjs
```

## GitHub Actions

El workflow se llama **E2E ciclo de examen** y solo se inicia mediante `workflow_dispatch`.

Configura como secretos del repositorio:

- `E2E_TEACHER_EMAIL`
- `E2E_TEACHER_PASSWORD`
- `E2E_STUDENT_NAME`
- `E2E_STUDENT_RUT`

Las credenciales nunca deben escribirse en el repositorio.

Al iniciar el workflow se solicita:

- URL segura de Preview o pruebas;
- código de examen E2E existente, opcional.

## Selectores configurables

La interfaz de exámenes puede evolucionar sin modificar la lógica productiva. Por eso los selectores se pueden definir como variables de GitHub Actions o variables de entorno:

- `E2E_CREATE_EXAM_SELECTOR`
- `E2E_EXAM_TITLE_SELECTOR`
- `E2E_EXAM_SUBJECT_SELECTOR`
- `E2E_SAVE_EXAM_SELECTOR`
- `E2E_PUBLISH_EXAM_SELECTOR`
- `E2E_EXAM_CODE_SELECTOR`
- `E2E_STUDENT_NAME_SELECTOR`
- `E2E_STUDENT_RUT_SELECTOR`
- `E2E_START_EXAM_SELECTOR`
- `E2E_SUBMIT_EXAM_SELECTOR`
- `E2E_CONFIRM_SUBMIT_SELECTOR`
- `E2E_RESULTS_SELECTOR`

Esto permite adaptar la prueba si cambia un texto o selector, sin modificar las páginas productivas.

## Examen existente

Para probar solamente el ciclo del estudiante y resultados:

```bash
export E2E_EXISTING_EXAM_CODE=CODIGO-E2E
```

El código debe corresponder a un examen creado exclusivamente para pruebas.

## Datos creados

Los exámenes nuevos usan el prefijo:

```text
E2E-EXAM-
```

Deben eliminarse o archivarse después de cada campaña de pruebas. La limpieza automática se agregará cuando exista una API administrativa de pruebas separada y protegida; hasta entonces, la eliminación es manual para evitar que una automatización borre información equivocada.

## Evidencias

Cuando una prueba falla, Playwright puede guardar:

- captura de pantalla;
- video;
- traza de navegación;
- reporte HTML.

Los artefactos de GitHub Actions se conservan durante 14 días. Deben revisarse antes de compartirlos porque pueden contener nombres de cuentas de prueba o contenido visible en pantalla.
