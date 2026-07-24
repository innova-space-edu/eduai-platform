import { test, expect } from "@playwright/test"

const teacherEmail = process.env.E2E_TEACHER_EMAIL || ""
const teacherPassword = process.env.E2E_TEACHER_PASSWORD || ""
const studentName = process.env.E2E_STUDENT_NAME || "Estudiante E2E"
const studentRut = process.env.E2E_STUDENT_RUT || "11111111-1"

const selectors = {
  createExam: process.env.E2E_CREATE_EXAM_SELECTOR || "text=Crear examen",
  title: process.env.E2E_EXAM_TITLE_SELECTOR || 'input[name="title"]',
  subject: process.env.E2E_EXAM_SUBJECT_SELECTOR || 'input[name="subject"]',
  saveExam: process.env.E2E_SAVE_EXAM_SELECTOR || "text=Guardar",
  publishExam: process.env.E2E_PUBLISH_EXAM_SELECTOR || "text=Publicar",
  examCode: process.env.E2E_EXAM_CODE_SELECTOR || '[data-testid="exam-code"]',
  studentName: process.env.E2E_STUDENT_NAME_SELECTOR || 'input[name="studentName"]',
  studentRut: process.env.E2E_STUDENT_RUT_SELECTOR || 'input[name="studentRut"]',
  startExam: process.env.E2E_START_EXAM_SELECTOR || "text=Comenzar",
  submitExam: process.env.E2E_SUBMIT_EXAM_SELECTOR || "text=Entregar",
  confirmSubmit: process.env.E2E_CONFIRM_SUBMIT_SELECTOR || "text=Confirmar",
  resultsLink: process.env.E2E_RESULTS_SELECTOR || "text=Resultados",
}

const configured = Boolean(teacherEmail && teacherPassword)
const runId = new Date().toISOString().replace(/[:.]/g, "-")
const examTitle = `E2E-EXAM-${runId}`
let examCode = process.env.E2E_EXISTING_EXAM_CODE || ""

async function login(page) {
  await page.goto("/login")
  await page.getByLabel(/email/i).fill(teacherEmail)
  await page.getByLabel(/contraseña/i).fill(teacherPassword)
  await page.getByRole("button", { name: /entrar/i }).click()
  await expect(page).toHaveURL(/dashboard|examen|agentes/, { timeout: 30_000 })
}

async function clickFirstVisible(page, selector) {
  const locator = page.locator(selector).filter({ visible: true }).first()
  await expect(locator).toBeVisible()
  await locator.click()
}

test.describe.serial("Ciclo completo del examen", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!configured, "Configura E2E_TEACHER_EMAIL y E2E_TEACHER_PASSWORD para ejecutar el ciclo completo.")
    page.on("dialog", dialog => dialog.accept())
  })

  test("docente crea, guarda y publica un examen", async ({ page }) => {
    if (examCode) {
      test.info().annotations.push({ type: "notice", description: "Se utiliza E2E_EXISTING_EXAM_CODE; se omite la creación." })
      return
    }

    await login(page)
    await page.goto("/examen/docente")
    await clickFirstVisible(page, selectors.createExam)

    await page.locator(selectors.title).first().fill(examTitle)

    const subjectInput = page.locator(selectors.subject).first()
    if (await subjectInput.count()) await subjectInput.fill("Prueba automatizada E2E")

    const questionText = page.locator('textarea[name*="question"], textarea[placeholder*="pregunta" i]').first()
    if (await questionText.count()) {
      await questionText.fill("¿Cuál es el resultado de 2 + 2?")
    }

    const optionInputs = page.locator('input[name*="option"], input[placeholder*="alternativa" i]')
    if (await optionInputs.count() >= 2) {
      await optionInputs.nth(0).fill("4")
      await optionInputs.nth(1).fill("5")
    }

    await clickFirstVisible(page, selectors.saveExam)
    await clickFirstVisible(page, selectors.publishExam)

    const codeLocator = page.locator(selectors.examCode).first()
    await expect(codeLocator).toBeVisible({ timeout: 30_000 })
    const codeText = (await codeLocator.textContent()) || ""
    const match = codeText.match(/[A-Z0-9-]{4,}/i)
    expect(match, `No se pudo extraer el código desde: ${codeText}`).toBeTruthy()
    examCode = match[0]

    await expect(page.getByText(examTitle, { exact: false })).toBeVisible()
  })

  test("estudiante ingresa, responde y entrega el examen", async ({ browser }) => {
    test.skip(!examCode, "No existe código de examen. Configura E2E_EXISTING_EXAM_CODE o corrige los selectores de creación.")

    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`/examen/p/${encodeURIComponent(examCode)}`)

    const nameInput = page.locator(selectors.studentName).first()
    if (await nameInput.count()) await nameInput.fill(studentName)

    const rutInput = page.locator(selectors.studentRut).first()
    if (await rutInput.count()) await rutInput.fill(studentRut)

    const startButton = page.locator(selectors.startExam).filter({ visible: true }).first()
    if (await startButton.count()) await startButton.click()

    await page.waitForLoadState("networkidle")

    const radios = page.locator('input[type="radio"]')
    const radioCount = await radios.count()
    for (let index = 0; index < radioCount; index += 4) {
      const radio = radios.nth(index)
      if (await radio.isVisible()) await radio.check({ force: true })
    }

    const textAnswers = page.locator('textarea[name*="answer"], textarea[placeholder*="respuesta" i]')
    for (let index = 0; index < await textAnswers.count(); index += 1) {
      const answer = textAnswers.nth(index)
      if (await answer.isVisible()) await answer.fill("Respuesta automatizada E2E")
    }

    await clickFirstVisible(page, selectors.submitExam)

    const confirmButton = page.locator(selectors.confirmSubmit).filter({ visible: true }).first()
    if (await confirmButton.count()) await confirmButton.click()

    await expect(page.getByText(/entregado|finalizado|recibido|resultado/i).first()).toBeVisible({ timeout: 30_000 })
    await context.close()
  })

  test("docente visualiza la entrega en resultados", async ({ page }) => {
    test.skip(!examCode, "No existe código de examen para verificar resultados.")

    await login(page)
    await page.goto("/examen/docente")

    const examRow = page.getByText(examTitle, { exact: false }).first()
    if (await examRow.count()) {
      await examRow.click()
    } else {
      const searchInput = page.locator('input[type="search"], input[placeholder*="buscar" i]').first()
      if (await searchInput.count()) await searchInput.fill(examCode)
    }

    await clickFirstVisible(page, selectors.resultsLink)
    await expect(page.getByText(studentName, { exact: false }).first()).toBeVisible({ timeout: 30_000 })
  })
})
