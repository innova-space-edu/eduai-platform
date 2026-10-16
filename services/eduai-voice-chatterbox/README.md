# EDUAI Chatterbox Multilingual V3 on ScientificBrain Cloud Run

This private inference service provides zero-shot Spanish voice cloning. The user must be an adult EDUAI administrator with MFA, private voice profile and recorded consent.

## Flow

EDUAI browser -> protected same-origin Vercel endpoint -> eduai-song-gateway (Supabase authorization, MFA and consent) -> private eduai-voice-engine (Cloud Run IAM) -> Chatterbox GPU -> encrypted private Supabase storage -> signed playback URL.

The GPU inference container receives only the source WAV and the text to synthesize, never Supabase credentials. The output is watermarked by upstream Chatterbox. Users cannot contact the GPU service directly unless authorized through Cloud Run IAM.

## No Hugging Face inference or downloading

The service uses ChatterboxMultilingualTTS.from_local with fully verified checkpoints downloaded from the independent ModelScope mirror at https://modelscope.cn/models/ResembleAI/chatterbox. This project uses no Hugging Face inference provider, Space, API key or runtime checkpoint download. The Python wheel includes upstream hub dependencies but HF_HUB_OFFLINE=1 prevents contacting HF.

The source is MIT licensed: https://github.com/resemble-ai/chatterbox .

Required model files in private GCS:
- ve.pt
- s3gen.pt
- t3_mtl23ls_v3.safetensors
- grapheme_mtl_merged_expanded_v1.json
- manifest.json containing SHA256 hashes for all checkpoint files.

GCS prefix: gs://scientificbrain-compute-artifacts-260133939682/eduai-voice-models/chatterbox-v3

Run the included stage-weights.cloudbuild.yaml as a Cloud Build job once. It downloads the four required files from ModelScope and validates them with SHA256 before uploading to Cloud Storage.

## Cloud Run GPU deployment (do not enable without checkpoint assets)

Build the Dockerfile inside services/eduai-voice-chatterbox and push image to the existing eduai-audio Artifact Registry repository. Deploy with NVIDIA L4 in us-central1, 4 vCPU, 16 GiB RAM, one max instance, zero minimum instances, concurrency 1, timeout 900 seconds and no public access.

Configure CHATTERBOX_MODEL_GCS_URI pointing at the GCS prefix above. Grant the GPU service account read-only checkpoint access; grant only the existing gateway service account roles/run.invoker on this private service. Do not grant allUsers.

A Compute Engine quota does NOT guarantee Cloud Run GPU availability; inspect specific Cloud Run GPU quota before deployment. Costs accrue for GPU start, inference and Cloud Build even when no Gemini paid voice API is used. Configure Google Cloud budget alerts.

Once the new GPU service successfully loads weights and returns a positive private /health, redeploy the existing gateway with VOICE_PROVIDER=chatterbox and CHATTERBOX_ENGINE_URL set to the private URL. Keep existing protected browser relay, admin-adult-MFA enforcement, consent and Supabase paths.

The gateway labels a profile ready only after the engine is reachable; it stores a reference identifier, not a trained model. The existing reference WAV and consent stay private in Supabase.

Deployment of the Vercel frontend alone does not change the Cloud Run gateway. Do not claim replication is working until both preparing and rendering a consented voice are verified.
