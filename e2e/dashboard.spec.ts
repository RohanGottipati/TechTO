import { expect, test } from "@playwright/test";

test.describe("ToronTwin dashboard", () => {
  test("loads the map and core panels", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "ToronTwin" })
    ).toBeVisible();
    // Map layers appear once geodata is loaded. Scenario controls, the map
    // legend, and the artificial idle caret are intentionally absent.
    await expect(page.getByText("Layers", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Scenario", { exact: true })).toHaveCount(0);
    await expect(page.locator(".chat-blink-caret")).toHaveCount(0);
    await expect(page.getByText("Neighbourhood sentiment")).toBeVisible();
    // The map canvas is present.
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  });

  test("toggles a layer", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("switch", { name: /Residents/ });
    await expect(toggle).toHaveAttribute("aria-checked", "true", {
      timeout: 30_000,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});
