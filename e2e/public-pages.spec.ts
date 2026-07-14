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
