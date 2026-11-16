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
  // When CAMPING_BASE_URL is supplied, test a deployed site. Without it,
  // start a local Vite server to test exactly the code in the current checkout,
  // including the 808 gate, the GLB, and all restored media.
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
