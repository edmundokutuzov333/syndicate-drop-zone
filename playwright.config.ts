import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/radio",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: process.env.CAMPING_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // CI sets CAMPING_BASE_URL to the actual Lovable production site. In that
  // mode do not start a local server: the smoke test must verify what visitors
  // receive, including the gate, the GLB and the photo assets.
  ...(process.env.CAMPING_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev -- --host 127.0.0.1 --port 4173",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: false,
          timeout: 180_000,
        },
      }),
});
