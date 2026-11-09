# Dell: activar Nano R2 y Lite R2 en Model Lab

El sitio de EDUAI ya incluye `/admin/model-lab/playground`. Para habilitar respuestas **reales** hacen falta: contenedor privado en Dell, ruta HTTPS del túnel existente y variables privadas de Vercel. No se crea ningún notebook ni se modifica R5.

## 1. Instalar en Dell

Con este repositorio actualizado en el Dell:

```bash
cd ~/eduai-platform/services/eduai-model-lab-inference
bash install-dell.sh
```

Si el repositorio está en otro directorio, entrar en `services/eduai-model-lab-inference` dentro de esa copia. El instalador:

- Reutiliza `~/eduai-advanced-v2/kaggle-v225.sh` cuando está disponible, o Kaggle CLI, para descargar **solo el dataset privado** `esthefano/eduai-nano-lite-adapters-r2`.
- Verifica que los pesos Nano (350M) y Lite (1.2B) son adaptadores LoRA del modelo base correcto.
- Genera `/srv/eduai-model-lab/.env` con token nuevo de alta entropía **sin mostrarlo**, reutilizándolo en reinstalaciones.
- Inicia `eduai-model-lab-inference` mediante Docker Compose con `127.0.0.1:8122` y la red `portal_default`, compartida con el contenedor existente `intranet-tunnel`.
- Comprueba `/healthz` y `/models` usando el token internamente.

Para probar inferencia real de ambos modelos, antes de publicar la ruta HTTPS:

```bash
cd ~/eduai-platform/services/eduai-model-lab-inference
sudo python3 verify-local.py --env-file /srv/eduai-model-lab/.env --smoke
```

La prueba `--smoke` usa Nano y Lite reales y puede demorar durante la primera descarga del modelo base. No crea nuevos adaptadores.

## 2. Agregar ruta al túnel Cloudflare existente

En Cloudflare Zero Trust, abrir **Networking → Tunnels**, seleccionar el túnel ya usado por `intranet-tunnel`, agregar una ruta de aplicación publicada (no crear otro túnel):

- Hostname sugerido: `models.innova-space-edu.cl` (comprobar que esté libre).
- Origen **desde el contenedor cloudflared**, no desde el host: `http://eduai-model-lab-inference:8000`.
- **No usar `http://127.0.0.1:8122` como origen del túnel**, porque `cloudflared` corre en otro contenedor Docker; ese loopback no es el host Dell.
- Aplicar una política Cloudflare Access **Service Auth** con un token de servicio específico para Vercel. No dar acceso público anónimo a este hostname.

El servicio exige adicionalmente su token Bearer privado, independientemente de Cloudflare Access. El contenedor solo expone el puerto 8122 en loopback; Docker DNS lo conecta al túnel por `portal_default`.

## 3. Variables de Vercel (proyecto EDUAI, Production)

En **Vercel → eduaiplatformclon → Settings → Environment Variables**, crear las siguientes variables de **servidor** (nunca `NEXT_PUBLIC_`):

| Variable | Valor |
|---|---|
| `EDUAI_MODEL_LAB_INFERENCE_URL` | `https://models.innova-space-edu.cl` (solo si la ruta anterior se creó) |
| `EDUAI_MODEL_LAB_INFERENCE_TOKEN` | Valor de `EDUAI_MODEL_LAB_TOKEN` guardado en el Dell |
| `EDUAI_MODEL_LAB_CF_CLIENT_ID` | ID del token Cloudflare Access Service Auth |
| `EDUAI_MODEL_LAB_CF_CLIENT_SECRET` | Secret de ese token Cloudflare |
| `EDUAI_MODEL_LAB_R5_APPROVED` | `false` |

No pegar secretos en el chat ni en GitHub. Tras guardar las variables, realizar **un nuevo despliegue de producción**; las variables no se aplican retroactivamente al deployment activo. Volver a cargar `https://eduai.innova-space-edu.cl/admin/model-lab/playground` y pulsar **Comprobar conexión**.

## 4. Diagnóstico

```bash
sudo docker ps --filter name=eduai-model-lab-inference
sudo docker logs --tail=80 eduai-model-lab-inference
curl -fsS http://127.0.0.1:8122/healthz
sudo python3 ~/eduai-platform/services/eduai-model-lab-inference/verify-local.py --env-file /srv/eduai-model-lab/.env --smoke
```

La web envía trabajos de inferencia y consulta su resultado en intervalos. Evita depender de una petición Vercel de varios minutos al cargar modelos CPU o al comparar Nano/Lite.

## Seguridad y alcance

El instalador no añade puertos públicos al host, no crea notebooks Kaggle, no promociona R5 ni modifica los modelos que ya están entrenando. El acceso de usuario a `/api/admin/model-lab-playground` requiere sesión administrativa. Los datos de pruebas no se agregan automáticamente al entrenamiento.

Si el administrador remoto del Dell **no permite instalar nuevos servicios**, debe ejecutarse `install-dell.sh` con permiso sudo en la terminal del propietario. La configuración del hostname y la política Service Auth deben realizarse con acceso autorizado al panel de Cloudflare. La disponibilidad real requiere verificar una respuesta generada por ambos modelos, no solo comprobar un HTTP 200.

---

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
