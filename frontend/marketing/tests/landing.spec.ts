import { expect, test } from "@playwright/test";

test("renders the Recall memory narrative without client errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expect(page).toHaveTitle(/Recall/);
  await expect(page.getByRole("heading", { name: /A memory layer for your computer/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Download preview/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /See the thread. Then follow it/i })).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(consoleErrors).toEqual([]);
});

test("switches the product preview and keeps navigation targets available", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Ask" }).click();
  await expect(page.getByText("ANSWER, GROUNDED IN 12 EVENTS")).toBeVisible();
  await expect(page.locator("#privacy")).toBeAttached();
  await expect(page.locator("#faq")).toBeAttached();
});
