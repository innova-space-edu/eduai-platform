# EDUAI Model Lab — Nano y Lite reales

## Rutas web
- /admin/model-lab#nano-lite (integrado en el laboratorio administrativo)
- /admin/model-lab/playground (página de prueba directa)
- API privada: /api/admin/model-lab-playground
- Servidor de inferencia Dell: services/eduai-model-lab-inference

## Preparar R2 en el Dell

Requiere Docker/Compose, memoria para ejecutar Lite de 1.2B parámetros en CPU y conectividad inicial a Hugging Face. Los pesos BASE se descargan y se combinan con los LoRA del dataset privado R2; no se usa Kaggle para responder en la web.

1. Llevar esta carpeta de GitHub al Dell.
2. Crear directorios: sudo mkdir -p /srv/eduai-model-lab/models /srv/eduai-model-lab/cache /srv/eduai-model-lab/incoming
3. Descargar el dataset Kaggle privado YA EXISTENTE esthefano/eduai-nano-lite-adapters-r2, sin crear otro notebook. Si kaggle CLI está configurado: kaggle datasets download esthefano/eduai-nano-lite-adapters-r2 -p /srv/eduai-model-lab/incoming --unzip
4. Preparar: sudo bash prepare-adapters.sh /srv/eduai-model-lab/incoming
5. Verificar los archivos nano-r2/adapter_model.safetensors, nano-r2/adapter_config.json, lite-r2/adapter_model.safetensors y lite-r2/adapter_config.json. Verificar checksums si disponibles. No usar los adaptadores R4 rechazados.
6. Crear archivo .env privado (permisos 0600) con EDUAI_MODEL_LAB_TOKEN y un secreto aleatorio largo, nunca escribirlo en GitHub ni en el chat.
7. Ejecutar: sudo chown -R 10001:10001 /srv/eduai-model-lab/cache
8. Iniciar: sudo docker compose --env-file .env -f compose.example.yml up -d --build
9. Comprobar: curl -fsS http://127.0.0.1:8122/healthz

El puerto de inferencia se expone únicamente a 127.0.0.1 del Dell. Un modelo se mantiene cargado a la vez para limitar RAM. La primera pregunta puede descargar el modelo base si no existe en caché.

## HTTPS privado Dell → Vercel
Usar el Cloudflare Tunnel del propietario hacia http://localhost:8122 con HTTPS externo y, preferiblemente, política Cloudflare Access para un token de servicio. Añadir al proyecto Vercel estas variables privadas, nunca NEXT_PUBLIC_:

- EDUAI_MODEL_LAB_INFERENCE_URL = URL fija HTTPS del servicio
- EDUAI_MODEL_LAB_INFERENCE_TOKEN = mismo token secreto del Dell
- EDUAI_MODEL_LAB_CF_CLIENT_ID = opcional, token de servicio Cloudflare Access
- EDUAI_MODEL_LAB_CF_CLIENT_SECRET = opcional, token de servicio Cloudflare Access
- EDUAI_MODEL_LAB_R5_APPROVED = false

Los tokens no se transmiten al navegador. El servidor no acepta URLs de inferencia suministradas por el usuario.

## Seguridad y evaluación
- Solo administradores autenticados y presentes en admin_emails.
- No se promueven modelos ni adaptadores de forma automática.
- R5 deshabilitado hasta superar las pruebas y estar expresamente aprobado, tanto en Vercel como en el Dell.
- Las respuestas de Nano/Lite provienen exclusivamente del servicio real. Si falta la conexión, se informa, no se improvisa un proveedor externo.
- La referencia de cálculo exacto es independiente y se muestra claramente separada de las respuestas del modelo.
- Las valoraciones se guardan solo en el navegador tras una acción explícita, y pueden exportarse como JSON. No entrenan automáticamente el modelo.
- La conversación de la pestaña se conserva temporalmente en sessionStorage; limpiar conversación la elimina.
- El endpoint limita tamaño, identifica modelos permitidos y aplica rate limiting básico por instancia; mantener también reglas Cloudflare para limitar ataques.
- No hay cambios de base de datos ni publicaciones de modelos.
- Los pesos son PEFT safetensors locales. No ejecutar texto de entrada como Python.

## Verificación
- node --experimental-strip-types scripts/test-model-lab-playground.mjs
- python -m py_compile services/eduai-model-lab-inference/server.py
- cd services/eduai-model-lab-inference && python -m unittest -v test_server
- La CI general ejecuta TypeScript, pruebas y build de Next.js.

El servicio debe instalarse y sus variables configurarse antes de que la página web pueda responder mediante los modelos. Una vista previa de Vercel sin la conexión mostrará correctamente Sin conexión, no respuestas simuladas.
