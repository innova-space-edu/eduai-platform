# EDUAI Audio Lab — Kaggle gratuito bajo demanda (Chatterbox V3)

La conexión inicial es **manual** y segura: no expone una API pública, no deja un notebook ejecutándose permanentemente y no traslada claves de EDUAI a Kaggle. Solo la persona administradora adulta con MFA puede asociar el resultado a una voz de EDUAI.

## Configurar por primera vez

1. Accede a [Kaggle Notebooks](https://www.kaggle.com/code/new) con tu cuenta.
2. Importa el notebook `notebooks/eduai_chatterbox_kaggle.ipynb`:
   - **File → Load from URL** y pega la URL de GitHub:
     https://github.com/innova-space-edu/eduai-platform/blob/main/notebooks/eduai_chatterbox_kaggle.ipynb
   - Si Kaggle no puede leer un repositorio privado, descarga el archivo `.ipynb` desde GitHub y utiliza la opción de importar/subir notebook de Kaggle.
3. Guarda tu notebook con visibilidad **Private**. No guardes muestras vocales o audios en notebooks públicos.
4. En Kaggle elige **Settings → Accelerator → GPU T4 x2** y **Turn on internet** para descargar las dependencias y el modelo desde ModelScope.
5. En EDUAI, ve a [Audio Lab → Mis voces](https://eduai.innova-space-edu.cl/audio-lab/voices), desbloquea tu zona protegida y pega en **Guardar enlace** la URL permanente de tu notebook guardado, de formato `https://www.kaggle.com/code/usuario/nombre`.
6. En adelante, el botón **Abrir mi notebook de Kaggle** abrirá esa misma página en otra pestaña. El enlace se guarda **en ese navegador** (localStorage): tendrás que pegarlo nuevamente en otro PC o navegador.

## Generar voz

1. Abre Kaggle desde EDUAI; selecciona T4 x2 e Internet si la sesión está apagada.
2. Ejecuta las celdas de instalación y descarga de pesos. Es normal que la primera sesión tarde varios minutos.
3. En el control de subida, proporciona **una muestra vocal propia de 10 a 30 segundos**, grabada con consentimiento, en WAV/MP3/M4A/OGG. La muestra se convertirá localmente a WAV mono PCM 24 kHz.
4. Ejecuta la celda que prepara la referencia en GPU. El notebook elimina la copia normalizada de la muestra del directorio de trabajo una vez cargada en la memoria del modelo.
5. Escribe el texto a generar en la variable `TEXTO` (máximo 550 caracteres para esta primera versión).
6. Ejecuta la generación, descarga `eduai_voz_kaggle.wav` desde la sección **Output**.
7. Vuelve a EDUAI → **Mis voces** y pulsa **Importar WAV de Kaggle** junto a tu perfil ya autorizado. El audio se guarda en `generated-voice-audio` (bucket privado) y aparece en **Audios importados de Kaggle** para escucharlo.

## Para una segunda sesión

Si Kaggle cerró la sesión, pulsa de nuevo **Abrir mi notebook de Kaggle**, vuelve a activar la GPU y ejecuta las celdas. Los pesos y la referencia en memoria no persisten entre sesiones; es normal que haya que volver a prepararlos. Con la misma sesión abierta, cambia `TEXTO` y ejecuta solo las celdas finales para repetir la generación.

## Seguridad y limitaciones

- **No** introduzcas `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, JWT de EDUAI, API keys ni claves de Google en el notebook.
- No abras túneles HTTP a Kaggle ni intentes convertirlo en servidor permanente. Esta solución utiliza solo archivos de salida manuales y GPU interactiva de Kaggle.
- Kaggle procesa temporalmente las muestras de voz subidas: es un servicio de terceros, sujeto a sus políticas. **Mantén privados el notebook y sus archivos; no uses muestras de terceros sin autorización y consentimiento**.
- La carga en EDUAI requiere sesión administradora mayor de edad, MFA AAL2 y perfil con muestra y consentimiento registrados. Los archivos se almacenan bajo el ID privado de tu cuenta y tienen URLs firmadas que caducan.
- Importar un WAV **no** cambia el perfil de `draft` a `ready`: Kaggle no habilita el motor de clonación permanente. La generación a través del botón **Replicar voz** en EDUAI sigue dependiendo de la infraestructura GPU desplegada.
- La cuota de GPU es gratuita solo mientras Kaggle la ofrezca para tu cuenta y dentro de sus límites. Cada T4 tiene 16 GB VRAM independiente; Chatterbox utiliza una GPU.
- El proceso de instalación necesita Internet de Kaggle y usa GitHub oficial + ModelScope; no usa HF Spaces ni llama a la API de clonación Gemini.
- Los primeros resultados deben evaluarse por calidad de español, entonación y semejanza antes de dar por validado el motor.
