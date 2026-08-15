import { fal } from "@fal-ai/client";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getExperimentalModel } from "@/lib/ai/admin-model-policy";

export const runtime = "nodejs";
export const maxDuration = 90;

type FalImage = {
  url?: string;
  content_type?: string;
  width?: number;
  height?: number;
};

type FalGenerationData = {
  images?: FalImage[];
  seed?: number;
  prompt?: string;
  timings?: Record<string, unknown>;
  has_nsfw_concepts?: boolean[];
};

const VALID_SIZES = new Set([
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
]);

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { user: null, error: "No autenticado" };

  const { data: isAdmin } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!isAdmin) return { user: null, error: "Acceso denegado" };
  return { user, error: null };
}

async function saveAudit(entry: Record<string, unknown>) {
  const admin = getAdminClient();
  if (!admin) {
    console.info("[AdminModelLab][Audit]", entry);
    return;
  }

  const { error } = await admin.from("admin_model_lab_runs").insert(entry);
  if (error) console.info("[AdminModelLab][AuditFallback]", entry, error.message);
}

export async function POST(request: Request) {
  const { user, error } = await requireAdmin();
  if (!user) return Response.json({ error }, { status: error === "No autenticado" ? 401 : 403 });

  if ((process.env.ADMIN_MODEL_LAB_ENABLED || "false").toLowerCase() !== "true") {
    return Response.json({ error: "El laboratorio está apagado. Configura ADMIN_MODEL_LAB_ENABLED=true en el servidor." }, { status: 503 });
  }

  if (!process.env.FAL_KEY) {
    return Response.json({ error: "Falta FAL_KEY en las variables de entorno del servidor." }, { status: 503 });
  }

  const body = await request.json();
  const modelId = String(body?.modelId || "").trim();
  const prompt = String(body?.prompt || "").trim();
  const imageSize = VALID_SIZES.has(String(body?.imageSize)) ? String(body.imageSize) : "landscape_4_3";
  const requestedSeed = Number(body?.seed);
  const seed = Number.isInteger(requestedSeed) && requestedSeed >= 0 ? requestedSeed : undefined;
  const enablePromptExpansion = Boolean(body?.enablePromptExpansion);

  if (!prompt) return Response.json({ error: "Prompt requerido" }, { status: 400 });
  if (prompt.length > 2500) return Response.json({ error: "El prompt supera el máximo de 2500 caracteres." }, { status: 400 });

  const model = getExperimentalModel(modelId);
  if (!model) return Response.json({ error: "Modelo no registrado" }, { status: 404 });
  if (!model.executable || model.status !== "ready" || model.adapter !== "fal" || !model.providerModelId) {
    await saveAudit({
      admin_id: user.id,
      admin_email: user.email,
      model_id: modelId,
      prompt,
      status: "blocked",
      error_message: "Modelo registrado sin adapter ejecutable",
    });
    return Response.json({ error: "Este modelo está registrado solo para revisión técnica y no puede ejecutarse." }, { status: 403 });
  }

  const startedAt = Date.now();

  try {
    const input: Record<string, unknown> = {
      prompt,
      image_size: imageSize,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
    };

    if (seed !== undefined) input.seed = seed;
    if (model.id === "z-image-turbo") {
      input.num_inference_steps = 8;
      input.acceleration = "regular";
      input.enable_prompt_expansion = enablePromptExpansion;
    } else {
      input.num_inference_steps = 4;
    }

    const result = await fal.subscribe(model.providerModelId, { input, logs: false });
    const data = result.data as FalGenerationData;
    const nsfwFlags = Array.isArray(data.has_nsfw_concepts) ? data.has_nsfw_concepts : [];
    const blockedBySafety = nsfwFlags.some(Boolean);
    const firstImage = data.images?.[0];
    const durationMs = Date.now() - startedAt;

    if (blockedBySafety || !firstImage?.url) {
      await saveAudit({
        admin_id: user.id,
        admin_email: user.email,
        model_id: model.id,
        provider_model_id: model.providerModelId,
        prompt,
        status: blockedBySafety ? "blocked" : "failed",
        safety_flags: nsfwFlags,
        duration_ms: durationMs,
        request_id: result.requestId,
        error_message: blockedBySafety ? "Resultado bloqueado por safety checker" : "El proveedor no devolvió una imagen",
      });
      return Response.json({ error: blockedBySafety ? "El safety checker bloqueó el resultado." : "El proveedor no devolvió una imagen." }, { status: 422 });
    }

    await saveAudit({
      admin_id: user.id,
      admin_email: user.email,
      model_id: model.id,
      provider_model_id: model.providerModelId,
      prompt,
      status: "completed",
      safety_flags: nsfwFlags,
      duration_ms: durationMs,
      request_id: result.requestId,
      image_url: firstImage.url,
      seed: data.seed ?? seed ?? null,
      output_metadata: { width: firstImage.width, height: firstImage.height, contentType: firstImage.content_type, timings: data.timings },
    });

    return Response.json({
      imageUrl: firstImage.url,
      modelId: model.id,
      modelLabel: model.label,
      providerModelId: model.providerModelId,
      requestId: result.requestId,
      seed: data.seed ?? seed ?? null,
      durationMs,
      width: firstImage.width ?? null,
      height: firstImage.height ?? null,
      safetyChecker: true,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    await saveAudit({
      admin_id: user.id,
      admin_email: user.email,
      model_id: model.id,
      provider_model_id: model.providerModelId,
      prompt,
      status: "failed",
      duration_ms: Date.now() - startedAt,
      error_message: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
