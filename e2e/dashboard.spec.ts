import { expect, test } from "@playwright/test";

/**
 * Shell smoke for the landing page and the /city dashboard. Live Backboard /
 * opinion-model calls are not exercised here (cost / latency); use
 * npm run backboard:smoke for that.
 */

test.describe("TechTO", () => {
  test("landing page links to the city dashboard", async ({ page }) => {
    await page.goto("/");
    const enter = page.getByRole("link", { name: /Enter the twin/ });
    await expect(enter).toBeVisible();
    await enter.click();
    await expect(page).toHaveURL(/\/city$/);
  });

  test("loads the map and core panels", async ({ page }) => {
    await page.goto("/city");
    await expect(page.getByRole("heading", { name: "TechTO" }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("tablist", { name: "City scenario" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Layers" })).toBeVisible();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 30_000 });
  });

  test("switches to a mock scenario", async ({ page }) => {
    await page.goto("/city");
    await page.getByRole("button", { name: /Mock scenarios/ }).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /King St full transit priority/ }).click();
    await expect(
      page.getByRole("tab", { name: /King St full transit priority/ })
    ).toHaveAttribute("aria-selected", "true");
  });

  test("toggles a layer", async ({ page }) => {
    await page.goto("/city");
    const toggle = page.getByRole("switch", { name: /Residents/ });
    await expect(toggle).toHaveAttribute("aria-checked", "true", {
      timeout: 30_000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
