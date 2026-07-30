import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for the one screen that exists. Gate-flow e2e arrives with the
 * stage-1 vertical slice, which is when there is a gate to drive.
 */
test("the lifecycle board lists all thirteen stages", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Data Product Factory" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(13);
  await expect(page.getByText("Consumption Discovery")).toBeVisible();
  await expect(page.getByText("Certification & Publication")).toBeVisible();
});
