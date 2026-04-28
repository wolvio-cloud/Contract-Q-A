import { test, expect } from "@playwright/test";

test("suggested question shows citations and navigates", async ({ page }) => {
  await page.goto("/qa");
  await page.getByRole("button", { name: /What's our total LD exposure/i }).click();
  await page.getByRole("button", { name: "↑" }).click();

  const citation = page.getByRole("link", { name: /C001 cl/i }).first();
  await expect(citation).toBeVisible();

  await citation.click();
  await expect(page).toHaveURL(/\/contracts\//);
  await expect(page).toHaveURL(/clause=/);
});
