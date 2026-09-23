import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const ACCOUNT_TYPES = new Set([
  "teacher",
  "university_student",
  "researcher",
  "professional",
  "other",
])

const ACCESS_TIERS = new Set([
  "restricted",
  "standard",
  "teacher",
  "researcher",
  "admin",
])

const FOUNDER_ADMINS = new Set([
  "admin@colprovidencia.cl",
  "emorales@colprovidencia.cl",
])

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL no configurada")
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada")

  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function requireAdmin() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, error: "No autenticado" }

  const { data: isAdmin, error } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email ?? "")
    .maybeSingle()

  if (error || !isAdmin) return { user: null, error: "Acceso denegado" }
  return { user, error: null }
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isUnder18(birthDate: string | null | undefined) {
  if (!birthDate) return false
  const birth = new Date(`${birthDate}T00:00:00Z`)
  if (Number.isNaN(birth.getTime())) return false

  const today = new Date()
  let age = today.getUTCFullYear() - birth.getUTCFullYear()
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth()
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1
  }
  return age < 18
}

async function loadUserBundle(userId: string) {
  const admin = getAdminClient()

  const [
    authResult,
    profileResult,
    accessResult,
    sessionsResult,
    reportsResult,
    examCountResult,
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin
      .from("eduai_user_access")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("study_sessions")
      .select("id, topic, status, score, created_at, study_mode")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("admin_reports")
      .select("id, subject, status, category, created_at, admin_reply")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("exam_submissions")
      .select("*", { count: "exact", head: true })
      .eq("student_id", userId),
  ])

  if (authResult.error) throw authResult.error

  const authUser = authResult.data.user
  const profile = profileResult.data
  const email = (authUser.email || profile?.email || "").toLowerCase()

  const { data: adminRecord } = email
    ? await admin
        .from("admin_emails")
        .select("email")
        .eq("email", email)
        .maybeSingle()
    : { data: null }

  return {
    profile,
    access: accessResult.data,
    account: {
      id: authUser.id,
      email: authUser.email || profile?.email || "",
      phone: authUser.phone || "",
      emailConfirmedAt: authUser.email_confirmed_at || null,
      createdAt: authUser.created_at,
      lastSignInAt: authUser.last_sign_in_at || null,
      bannedUntil: authUser.banned_until || null,
      suspended: Boolean(
        authUser.banned_until &&
          new Date(authUser.banned_until).getTime() > Date.now(),
      ),
      isPanelAdmin: Boolean(adminRecord),
      userMetadata: authUser.user_metadata || {},
    },
    sessions: sessionsResult.data || [],
    reports: reportsResult.data || [],
    examCount: examCountResult.count || 0,
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAdmin()
  if (!user) {
    return NextResponse.json(
      { error },
      { status: error === "No autenticado" ? 401 : 403 },
    )
  }

  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 })
    }

    return NextResponse.json(await loadUserBundle(id))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user: currentAdmin, error } = await requireAdmin()
  if (!currentAdmin) {
    return NextResponse.json(
      { error },
      { status: error === "No autenticado" ? 401 : 403 },
    )
  }

  try {
    const { id: userId } = await context.params
    const body = await request.json()
    const admin = getAdminClient()

    const { data: authData, error: authError } =
      await admin.auth.admin.getUserById(userId)
    if (authError) throw authError

    const authUser = authData.user
    const oldEmail = (authUser.email || "").trim().toLowerCase()
    const requestedEmail =
      body.email === undefined ? oldEmail : String(body.email).trim().toLowerCase()

    if (!requestedEmail || !validEmail(requestedEmail)) {
      return NextResponse.json(
        { error: "Correo electrónico inválido" },
        { status: 400 },
      )
    }

    const name =
      body.name === undefined ? undefined : String(body.name).trim().slice(0, 120)

    const authPatch: Record<string, unknown> = {}
    if (requestedEmail !== oldEmail) {
      authPatch.email = requestedEmail
      authPatch.email_confirm = true
    }
    if (name !== undefined) {
      authPatch.user_metadata = {
        ...(authUser.user_metadata || {}),
        name,
      }
    }

    if (Object.keys(authPatch).length > 0) {
      const { error: updateAuthError } =
        await admin.auth.admin.updateUserById(userId, authPatch)
      if (updateAuthError) throw updateAuthError
    }

    const profilePatch: Record<string, unknown> = {
      email: requestedEmail,
    }
    if (name !== undefined) profilePatch.name = name
    if (body.xp !== undefined) {
      const xp = Number(body.xp)
      if (!Number.isFinite(xp)) {
        return NextResponse.json({ error: "XP inválido" }, { status: 400 })
      }
      profilePatch.xp = Math.max(0, Math.trunc(xp))
    }
    if (body.level !== undefined) {
      const level = Number(body.level)
      if (!Number.isFinite(level)) {
        return NextResponse.json({ error: "Nivel inválido" }, { status: 400 })
      }
      profilePatch.level = Math.min(6, Math.max(1, Math.trunc(level)))
    }
    if (body.streak_days !== undefined) {
      const streak = Number(body.streak_days)
      if (!Number.isFinite(streak)) {
        return NextResponse.json({ error: "Racha inválida" }, { status: 400 })
      }
      profilePatch.streak_days = Math.max(0, Math.trunc(streak))
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", userId)
    if (profileError) throw profileError

    const { data: access } = await admin
      .from("eduai_user_access")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()

    if (access) {
      const accessPatch: Record<string, unknown> = {}

      if (body.account_type !== undefined) {
        const accountType = String(body.account_type)
        if (!ACCOUNT_TYPES.has(accountType)) {
          return NextResponse.json(
            { error: "Tipo de cuenta inválido" },
            { status: 400 },
          )
        }
        accessPatch.account_type = accountType
      }

      if (body.country_code !== undefined) {
        const country = String(body.country_code).trim().toUpperCase()
        if (country && !/^[A-Z]{2}$/.test(country)) {
          return NextResponse.json(
            { error: "Código de país inválido" },
            { status: 400 },
          )
        }
        accessPatch.country_code = country || null
      }

      if (Object.keys(accessPatch).length > 0) {
        const { error: accessError } = await admin
          .from("eduai_user_access")
          .update(accessPatch)
          .eq("user_id", userId)
        if (accessError) throw accessError
      }

      if (body.access_tier !== undefined) {
        const accessTier = String(body.access_tier)
        if (!ACCESS_TIERS.has(accessTier)) {
          return NextResponse.json(
            { error: "Nivel de acceso inválido" },
            { status: 400 },
          )
        }

        if (isUnder18(access.birth_date) && accessTier !== "restricted") {
          return NextResponse.json(
            {
              error:
                "Las cuentas de menores de 18 años deben permanecer con acceso restringido.",
            },
            { status: 400 },
          )
        }

        const { error: tierError } = await admin
          .from("eduai_user_access")
          .update({ access_tier: accessTier })
          .eq("user_id", userId)
        if (tierError) throw tierError
      }
    }

    if (typeof body.panel_admin === "boolean") {
      const targetEmail = requestedEmail

      if (body.panel_admin) {
        const { error: addAdminError } = await admin
          .from("admin_emails")
          .upsert({ email: targetEmail }, { onConflict: "email" })
        if (addAdminError) throw addAdminError
      } else {
        if (FOUNDER_ADMINS.has(oldEmail) || FOUNDER_ADMINS.has(targetEmail)) {
          return NextResponse.json(
            { error: "No se puede remover un administrador fundador." },
            { status: 403 },
          )
        }
        if ((currentAdmin.email || "").toLowerCase() === oldEmail) {
          return NextResponse.json(
            { error: "No puedes quitarte tu propio acceso de administrador." },
            { status: 403 },
          )
        }

        const { error: removeAdminError } = await admin
          .from("admin_emails")
          .delete()
          .eq("email", oldEmail)
        if (removeAdminError) throw removeAdminError
      }
    } else if (requestedEmail !== oldEmail) {
      const { data: existingAdmin } = await admin
        .from("admin_emails")
        .select("email")
        .eq("email", oldEmail)
        .maybeSingle()

      if (existingAdmin) {
        const { error: preserveAdminError } = await admin
          .from("admin_emails")
          .upsert({ email: requestedEmail }, { onConflict: "email" })
        if (preserveAdminError) throw preserveAdminError

        if (!FOUNDER_ADMINS.has(oldEmail)) {
          await admin.from("admin_emails").delete().eq("email", oldEmail)
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...(await loadUserBundle(userId)),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { user, error } = await requireAdmin()
  if (!user) {
    return NextResponse.json(
      { error },
      { status: error === "No autenticado" ? 401 : 403 },
    )
  }

  try {
    const { id: userId } = await context.params
    const body = await request.json()
    const action = String(body.action || "")
    const admin = getAdminClient()

    if (action === "set_password") {
      const password = String(body.password || "")
      if (password.length < 8) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 8 caracteres." },
          { status: 400 },
        )
      }
      if (password.length > 128) {
        return NextResponse.json(
          { error: "La contraseña es demasiado larga." },
          { status: 400 },
        )
      }

      const { error: passwordError } =
        await admin.auth.admin.updateUserById(userId, { password })
      if (passwordError) throw passwordError

      return NextResponse.json({ success: true })
    }

    if (action === "set_suspension") {
      const suspended = Boolean(body.suspended)
      const { error: suspendError } =
        await admin.auth.admin.updateUserById(userId, {
          ban_duration: suspended ? "876000h" : "none",
        })
      if (suspendError) throw suspendError

      return NextResponse.json({
        success: true,
        ...(await loadUserBundle(userId)),
      })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 },
    )
  }
}
