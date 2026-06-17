import { expect, test } from "@playwright/test";

test("AABW Next Move dashboard renders core workflow", async ({ page }) => {
  await page.goto("/dashboard/next-move");

  await expect(page.getByText("AABW Next Move").first()).toBeVisible();
  await expect(page.getByText("Next move", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy plan" })).toBeVisible();
  await expect(page.getByText(/Supabase live|Mock fallback/)).toBeVisible();
  await expect(page.getByText(/OpenAI on|AI fallback/)).toBeVisible();
  await expect(
    page
      .getByText("keyword RAG", { exact: true })
      .or(page.getByText("pgvector", { exact: true }))
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Venue map", { exact: true })).toBeVisible();
  await expect(page.getByText("Event mode", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy event brief" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add calendar hold" })).toBeVisible();
  await expect(page.getByText("Live triage", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy help request" })).toBeVisible();
  await expect(page.getByText("Team radar", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy team intro" })).toBeVisible();
  await expect(page.getByText("Launch kit", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy progress update" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Devpost summary" })).toBeVisible();
  await expect(page.getByText("Semantic retrieval")).toBeVisible();
  await expect(page.getByText("Saved plans")).toBeVisible();
});
