import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000"
const productionHost = "eduaiplatformclon.vercel.app"

if (baseURL.includes(productionHost) && process.env.E2E_ALLOW_PRODUCTION !== "true") {
  throw new Error(
    "Bloqueo de seguridad: las pruebas E2E no pueden ejecutarse contra producción. Usa un despliegue Preview, localhost o define E2E_ALLOW_PRODUCTION=true de forma consciente.",
  )
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  outputDir: "test-results/e2e",
  projects: [
    {
      name: "chromium-exam-cycle",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
})
