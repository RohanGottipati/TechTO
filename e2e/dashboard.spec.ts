import { expect, test } from "@playwright/test";

test.describe("TechTO dashboard", () => {
  test("loads the map and core panels", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "TechTO" })
    ).toBeVisible();
    // Panels appear once geodata is loaded.
    await expect(page.getByText("Scenario", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Day-one acceptance")).toBeVisible({
      timeout: 30_000,
    });
    // The map canvas is present.
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  });

  test("switches scenarios", async ({ page }) => {
    await page.goto("/");
    const king = page.getByRole("button", {
      name: /King St full transit priority/,
    });
    await king.click({ timeout: 30_000 });
    await expect(king).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText(/Ban through car traffic on King/)
    ).toBeVisible();
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
