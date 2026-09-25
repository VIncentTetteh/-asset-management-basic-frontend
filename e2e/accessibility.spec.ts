import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of ["/", "/login", "/register-tenant"]) {
  test(`${route} has no serious or critical automated accessibility violations`, async ({ page }) => {
    await page.goto(route);
    // The landing page intentionally animates content into view. Audit the
    // stable visual state, not a transient partially-transparent frame.
    await page.waitForTimeout(1_000);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const releaseBlocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    expect(releaseBlocking, JSON.stringify(releaseBlocking, null, 2)).toEqual([]);
  });
}

test("login form is operable with the keyboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").focus();
  await page.keyboard.type("operator@example.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type("not-a-real-password");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
