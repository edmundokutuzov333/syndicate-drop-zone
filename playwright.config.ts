import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/radio",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Preview the generated Nitro deployment output directly. The Vite preview
    // adapter expects dist/server/server.js, which this app's Nitro build does not
    // emit because its server output is produced under the Nitro preset.
    command: "npx nitro preview",
    url: "http://127.0.0.1:4173",
    env: {
      HOST: "127.0.0.1",
      PORT: "4173",
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: "4173",
    },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
