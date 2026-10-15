import { expect, type Page } from "@playwright/test";

/**
 * Unlock the real site gate using its visible keypad. Avoid pre-seeding
 * sessionStorage before SSR, which makes server/client initial markup diverge
 * and can prevent React from hydrating event handlers in browser tests.
 */
export async function unlockSite(page: Page, afterUnlock?: () => void): Promise<void> {
  const siteGate = page.locator('[data-site-gate="locked"]');
  if (!(await siteGate.isVisible().catch(() => false))) {
    afterUnlock?.();
    return;
  }
  const ok = siteGate.getByRole("button", { name: "OK", exact: true });
  await expect(siteGate).toHaveAttribute("data-gate-hydrated", "true", { timeout: 15_000 });
  const display = siteGate.locator('[aria-live="polite"][aria-atomic="true"]');
  const sequence = [
    { digit: "8", expected: "8__" },
    { digit: "0", expected: "80_" },
    { digit: "8", expected: "808" },
  ];

  for (const step of sequence) {
    await siteGate.getByRole("button", { name: step.digit, exact: true }).click();
    await expect(display).toHaveText(step.expected);
  }

  await ok.click();
  // Release deliberately paused model requests before waiting for React to
  // remove the gate. This avoids deadlocking gate transition and GLB startup.
  afterUnlock?.();
  await expect(siteGate).toHaveCount(0, { timeout: 5_000 });
}
