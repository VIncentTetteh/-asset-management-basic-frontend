import { test, expect } from "@playwright/test";

test.describe("Public marketing pages", () => {
  test("landing page renders with expected title and content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/AssetIQ/);
    await expect(page.getByRole("heading", { name: /Designed for scale/i })).toBeVisible();
  });

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/Sign in to your Enterprise Asset Management account/i)).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  });

  test("login rejects empty submission with a validation message", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Sign in/i }).click();
    await expect(page.getByText(/Email is required/i)).toBeVisible();
  });
});

test.describe("Public legal pages", () => {
  // The mobile app links here for store review, so a signed-out visitor must
  // land on the page itself, not be bounced to /login.
  for (const { path, heading } of [
    { path: "/privacy", heading: /Privacy Policy/i },
    { path: "/terms", heading: /Terms of Service/i },
  ]) {
    test(`${path} renders without signing in`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      // trailingSlash: true in next.config.ts, so accept /privacy or /privacy/.
      await expect(page).toHaveURL(new RegExp(`${path}/?$`));
    });
  }

  test("footer links to privacy and terms", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("navigation", { name: "Footer" });
    await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });
});
