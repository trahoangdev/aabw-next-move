import { expect, test } from "@playwright/test";

test("AABW Next Move dashboard renders core workflow", async ({ page }) => {
  await page.goto("/dashboard/next-move");

  await expect(page.getByText("AABW Next Move").first()).toBeVisible();
  await expect(page.getByText("Next move", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy plan" })).toBeVisible();
  await expect(page.getByText(/Supabase live|Mock fallback/)).toBeVisible();
  await expect(page.getByText(/OpenAI on|AI fallback/)).toBeVisible();
  await expect(page.getByText(/pgvector|keyword RAG/)).toBeVisible();
  await expect(page.getByText("Venue map")).toBeVisible();
  await expect(page.getByText("Semantic retrieval")).toBeVisible();
  await expect(page.getByText("Saved plans")).toBeVisible();
});
