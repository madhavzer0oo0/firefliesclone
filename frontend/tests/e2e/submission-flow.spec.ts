import { test, expect } from "@playwright/test";
import type { MeetingImportResult, MeetingPage, Summary, Chapter } from "../../src/types/api";

const base = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

test("submission journey: library to overview/playback, import, task CRUD, metadata, reload and delete", async ({ page, request }) => {
  test.skip(process.env.PLAYWRIGHT_ISOLATED_DB !== "1", "Use scripts/test-e2e.ps1; never write to a user's database.");
  const library = await (await request.get(`${base}/meetings`)).json() as MeetingPage;
  const seeded = library.items[0];
  await page.goto("/meetings");
  const search = page.getByRole("searchbox", { name: "Search meetings by title or participant" });
  await search.fill(seeded.title);
  await expect(page.getByTestId("meeting-card")).toHaveCount(1);
  await page.getByRole("link", { name: `Open ${seeded.title}`, exact: true }).click();
  const summary = await (await request.get(`${base}/meetings/${seeded.id}/summary`)).json() as Summary;
  const chapters = await (await request.get(`${base}/meetings/${seeded.id}/chapters`)).json() as Chapter[];
  await expect(page.getByTestId("full-summary")).toHaveText(summary.overview);
  for (const chapter of chapters) await expect(page.getByText(chapter.title, { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  await page.getByTestId("transcript-segment").nth(2).click();
  await expect(page.getByTestId("playback-time")).toHaveAttribute("data-time", "30");
  const slider = page.getByRole("slider", { name: "Seek meeting playback" });
  await slider.focus();
  await slider.press("Home");
  await expect(page.getByTestId("transcript-segment").first()).toHaveAttribute("data-active", "true");
  await page.getByRole("searchbox", { name: "Search transcript" }).fill("meeting");
  await expect(page.locator(".transcript-text mark").first()).toBeVisible();

  let id: number | undefined;
  try {
    await page.goto("/meetings");
    await page.getByRole("link", { name: "Create meeting", exact: true }).click();
    await page.getByLabel("Meeting title", { exact: true }).fill("Submission journey meeting");
    await page.getByLabel("Date and time", { exact: true }).fill("2026-10-09T10:00");
    await page.getByLabel("Duration (minutes)", { exact: true }).fill("1");
    await page.getByLabel("Participant 1 name", { exact: true }).fill("Submission reviewer");
    await page.getByLabel("Participant 1 email", { exact: true }).fill("reviewer@submission.example");
    await page.getByLabel("Transcript text", { exact: true }).fill("[00:00] Submission reviewer: Review the submission.\n[00:30] Submission reviewer: Confirm persistence.");
    await page.getByLabel("Meeting summary", { exact: true }).fill("A persisted submission summary.");
    const response = page.waitForResponse(r => r.url() === `${base}/meetings/import` && r.status() === 201);
    await page.getByRole("button", { name: "Create meeting", exact: true }).click();
    id = ((await (await response).json()) as MeetingImportResult).meeting.id;
    await expect(page).toHaveURL(`/meetings/${id}`);
    await expect(page.getByTestId("full-summary")).toHaveText("A persisted submission summary.");
    await page.getByRole("tab", { name: "Action Items", exact: true }).click();
    await page.getByRole("button", { name: "Add action item", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Add action item", exact: true });
    await dialog.getByLabel("Description").fill("Prepare final demo");
    await dialog.getByRole("button", { name: "Add action item", exact: true }).click();
    const row = page.getByTestId("action-item");
    await expect(row).toContainText("Prepare final demo");
    await row.getByRole("button", { name: /^Edit action item:/ }).click();
    dialog = page.getByRole("dialog", { name: "Edit action item", exact: true });
    await dialog.getByLabel("Description").fill("Prepare verified demo");
    await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(row).toContainText("Prepare verified demo");
    // Server-confirmed controlled input: wait for PATCH before asserting completion.
    await row.getByRole("checkbox").click();
    await expect(row).toHaveAttribute("data-status", "completed");
    await page.reload();
    await page.getByRole("tab", { name: "Action Items", exact: true }).click();
    await expect(row.getByRole("checkbox")).toBeChecked();
    await row.getByRole("button", { name: /^Delete action item:/ }).click();
    await page.getByRole("dialog", { name: "Delete action item?", exact: true }).getByRole("button", { name: "Delete action item", exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Edit meeting", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Edit meeting", exact: true });
    await dialog.getByLabel("Meeting title", { exact: true }).fill("Submission journey verified");
    await dialog.getByRole("button", { name: "Add participant", exact: true }).click();
    await dialog.getByLabel("Participant 2 name", { exact: true }).fill("Added reviewer");
    await dialog.getByLabel("Participant 2 email", { exact: true }).fill("added@submission.example");
    await dialog.getByRole("button", { name: "Save meeting", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Submission journey verified", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Submission journey verified", exact: true })).toBeVisible();
    const saved = await (await request.get(`${base}/meetings/${id}`)).json();
    expect(saved.participants.map((person: { email: string }) => person.email)).toContain("added@submission.example");
    expect(await (await request.get(`${base}/meetings/${id}/action-items`)).json()).toEqual([]);
    await page.getByRole("tab", { name: "Transcript", exact: true }).click();
    await expect(page.getByTestId("transcript-segment")).toHaveCount(2);
    await page.getByRole("button", { name: "Delete meeting", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete meeting?", exact: true }).getByRole("button", { name: "Delete meeting", exact: true }).click();
    await expect(page).toHaveURL("/meetings");
    await page.reload();
    await search.fill("Submission journey verified");
    await expect(page.getByTestId("meeting-card")).toHaveCount(0);
    for (const collection of ["", "/transcript", "/summary", "/chapters", "/action-items"]) {
      expect((await request.get(`${base}/meetings/${id}${collection}`)).status()).toBe(404);
    }
  } finally {
    if (id) await request.delete(`${base}/meetings/${id}`);
  }
});
