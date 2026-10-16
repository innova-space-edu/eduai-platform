# Innova Kaggle MCP · v1 (privado/experimental)

Conector para consultar notebooks de Kaggle desde un cliente MCP compatible e integrar el entrenamiento de EDUAI Model Lab. **No está conectado todavía a ChatGPT ni a Kaggle**, porque faltan autenticar la cuenta, desplegar el servicio y comprobar los permisos de la plataforma. No modifica producción.

## Herramientas

- kaggle_connection_status: estado de configuración sin exponer credenciales.
- kaggle_list_my_notebooks: lista de notebooks propios.
- kaggle_notebook_status: estado de una ejecución.
- kaggle_notebook_output_files: enumera artefactos sin descargar pesos.
- kaggle_eduai_training_report: obtiene solo dos reportes JSON pequeños.
- kaggle_submit_eduai_phase1: publica el notebook fijo EDUAI en modo **privado**, deshabilitado por defecto. Sin ejecución por defecto. Requiere habilitar la operación y confirmación del usuario. No acepta código arbitrario.

## Credenciales: dos capas diferentes

1. **Kaggle**: crear un token API en https://www.kaggle.com/settings/api y almacenarlo en una variable de entorno privada KAGGLE_API_TOKEN (o usar OAuth propio del Kaggle CLI). No compartirlo aquí, en notebooks ni en GitHub.
2. **MCP**: crear un token aleatorio distinto de al menos 32 caracteres, y configurarlo como KAGGLE_MCP_BEARER en el servidor. Esto permite probar clientes privados con Bearer estático; **no implementa todavía OAuth para ChatGPT**.

La documentación actual de ChatGPT limita las conexiones MCP personalizadas con herramientas de escritura según plan y permisos. No garantizar compatibilidad con ChatGPT Plus. Se requiere un endpoint seguro, compatible con el sistema de autenticación del cliente y autorizado por su plan.

## Instalación local segura

Se necesita Python 3.11+, un entorno aislado y el ejecutable de Kaggle CLI.

~~~bash
cd integrations/kaggle-mcp
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Configura KAGGLE_API_TOKEN y KAGGLE_MCP_BEARER mediante un gestor de secretos.
python server.py
~~~

La interfaz escucha en 127.0.0.1:8789/mcp. No abrir al público sin revisión de OAuth, TLS, allowlist de hosts/orígenes y protección de acceso. Puede utilizarse un túnel MCP seguro para un servidor Debian privado cuando el cliente lo admita.

## Mutaciones: apagadas hasta autorización

Configurar KAGGLE_ENABLE_WRITES=true y KAGGLE_ALLOWED_OWNER a la cuenta autorizada; confirmar cada acción con confirmed=true. Una ejecución GPU requiere también KAGGLE_GPU_RUNS_ENABLED=true y run_gpu=true. Kaggle puede seguir rechazando GPU aunque se solicite desde API; el conector no evade verificación de teléfono ni cuotas. Solo se permite subir el notebook auditado en training/eduai-local/kaggle/EDUAI_Model_Factory_Kaggle_Phase1.ipynb. Nunca sustituirlo por código generado automáticamente sin revisión.

## Validación sin Kaggle

~~~bash
cd integrations/kaggle-mcp
python -m unittest discover -s tests -p 'test_*.py' -v
python -m py_compile client.py server.py
~~~

La primera versión comprueba operaciones de lectura y políticas de autorización mediante mocks. No certifica una integración real con Kaggle, ni la seguridad final de un despliegue público.

## Dependencia de EDUAI Phase 1

La herramienta opcional de publicación requiere el notebook preparado en [PR #247](https://github.com/innova-space-edu/eduai-platform/pull/247), todavía pendiente de fusionar. Hasta integrarlo, los comandos de **lectura** no dependen de ese PR; la acción de publicación devuelve un error controlado si el archivo no existe. No fusionar ambos PR ni desplegar en producción sin pruebas.

## Próximas fases

- V1.1: enlazar cuenta Kaggle por token privado, verificar el listado y el estado de un notebook, habilitar hosting y OAuth para ChatGPT si el plan lo permite.
- V2: primer entrenamiento de EDUAI Nano y reportes guardados, sin datos personales de estudiantes.
- V3: aprobaciones centralizadas, evidencias verificables, publicación controlada en EDUAI Candidate Lab y router GPU Kaggle/Colab/local.
