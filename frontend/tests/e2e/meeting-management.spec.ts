import { test, expect, type APIRequestContext } from "@playwright/test";
import type { Meeting } from "../../src/types/api";

const base = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";
test.beforeEach(() => test.skip(process.env.PLAYWRIGHT_ISOLATED_DB !== "1", "Use the disposable database browser-test script."));

async function create(request: APIRequestContext): Promise<Meeting> {
  const response = await request.post(`${base}/meetings`, { data: { title: "Management workflow fixture", started_at: "2026-10-08T05:00:00Z", duration_seconds: 60, participants: [{ name: "Workflow speaker", email: "workflow@example.com" }, { name: "Optional guest", email: "optional@example.com" }] } });
  expect(response.status()).toBe(201);
  const meeting: Meeting = await response.json();
  expect((await request.put(`${base}/meetings/${meeting.id}/transcript`, { data: [{ position: 0, speaker_id: meeting.participants[0].id, start_seconds: 0, end_seconds: 20, text: "Introduction to the workflow." }, { position: 1, speaker_id: meeting.participants[0].id, start_seconds: 20, end_seconds: 60, text: "Unique transcript needle and follow-up." }] })).ok()).toBeTruthy();
  return meeting;
}

test("dashboard edit, keyboard cancellation, participant membership, persistence, and confirmed deletion", async ({ page, request }) => {
  const meeting = await create(request);
  try {
    await page.goto("/meetings");
    const search = page.getByRole("searchbox");
    await search.fill(meeting.title);
    await expect(page.getByTestId("meeting-card")).toHaveCount(1);
    await page.getByRole("button", { name: `Edit meeting: ${meeting.title}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit meeting", exact: true });
    await expect(dialog.getByLabel("Meeting title", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: `Edit meeting: ${meeting.title}`, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Remove participant 1", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Remove participant 2", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "Remove participant 2", exact: true }).click();
    await dialog.getByRole("button", { name: "Add participant", exact: true }).click();
    await dialog.getByLabel("Participant 2 name", { exact: true }).fill("Added attendee");
    await dialog.getByLabel("Participant 2 email", { exact: true }).fill("added@workflow.example");
    await dialog.getByLabel("Meeting title", { exact: true }).fill("Management workflow edited");
    await dialog.getByLabel("Meeting title", { exact: true }).press("Enter");
    await expect(page.getByText("Meeting updated.", { exact: true })).toBeVisible();
    await search.fill("Management workflow edited");
    await expect(page.getByTestId("meeting-card")).toHaveCount(1);
    await page.reload();
    await search.fill("Management workflow edited");
    await expect(page.getByTestId("meeting-card")).toHaveCount(1);
    await expect(page.getByTestId("meeting-card")).toContainText("Added attendee");
    const saved: Meeting = await (await request.get(`${base}/meetings/${meeting.id}`)).json();
    expect(saved.participants.map(person => person.email)).toEqual(["workflow@example.com", "added@workflow.example"]);
    await page.getByRole("button", { name: "Delete meeting: Management workflow edited", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "Delete meeting?", exact: true });
    await expect(deletion.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await deletion.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await request.get(`${base}/meetings/${meeting.id}`)).status()).toBe(200);
    await page.getByRole("button", { name: "Delete meeting: Management workflow edited", exact: true }).click();
    await deletion.getByRole("button", { name: "Delete meeting", exact: true }).click();
    await expect(page.getByText("Meeting deleted.", { exact: true })).toBeVisible();
    await expect(page.getByTestId("meeting-card")).toHaveCount(0);
    expect((await request.get(`${base}/meetings/${meeting.id}`)).status()).toBe(404);
    await page.reload();
    await search.fill("Management workflow edited");
    await expect(page.getByTestId("meeting-card")).toHaveCount(0);
  } finally { await request.delete(`${base}/meetings/${meeting.id}`); }
});

test("combined title/participant/date filters, global snippet navigation, and detail editing preserve transcript state", async ({ page, request }) => {
  const meeting = await create(request);
  try {
    await page.goto("/meetings");
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByLabel("Filter by title").fill("Management workflow");
    await page.getByLabel("Filter by participant").fill("workflow@example.com");
    await page.getByLabel("Start date", { exact: true }).fill("2026-10-08");
    await page.getByLabel("End date", { exact: true }).fill("2026-10-08");
    await expect(page.getByTestId("meeting-card")).toHaveCount(1);
    await page.getByLabel("Include transcript content in search").check();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("searchbox").fill("Unique transcript needle");
    const match = page.getByRole("link", { name: `Open transcript match in ${meeting.title}`, exact: true });
    await expect(match.locator("mark")).toHaveText("Unique transcript needle");
    await match.click();
    await expect(page.getByRole("tab", { name: "Transcript", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("playback-time")).toHaveAttribute("data-time", "20");
    await expect(page.getByRole("searchbox", { name: "Search transcript" })).toHaveValue("Unique transcript needle");
    await page.getByRole("button", { name: "Edit meeting", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit meeting", exact: true });
    await dialog.getByLabel("Meeting title", { exact: true }).fill("Detail edited meeting");
    await dialog.getByRole("button", { name: "Save meeting", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Detail edited meeting", exact: true })).toBeVisible();
    await expect(page.getByTestId("playback-time")).toHaveAttribute("data-time", "20");
    await expect(page.getByRole("tab", { name: "Transcript", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Detail edited meeting", exact: true })).toBeVisible();
    await expect(page.getByTestId("playback-time")).toHaveAttribute("data-time", "20");
    await page.getByRole("tab", { name: "Action Items", exact: true }).click();
    await expect(page.getByRole("button", { name: "Add action item", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await page.getByRole("button", { name: "Delete meeting", exact: true }).click();
    await page.getByRole("dialog", { name: "Delete meeting?" }).getByRole("button", { name: "Delete meeting", exact: true }).click();
    await expect(page).toHaveURL("/meetings");
    expect((await request.get(`${base}/meetings/${meeting.id}/transcript`)).status()).toBe(404);
  } finally { await request.delete(`${base}/meetings/${meeting.id}`); }
});

test("failed metadata and delete operations keep dialogs and persisted data intact", async ({ page, request }) => {
  const meeting = await create(request);
  try {
    await page.goto(`/meetings/${meeting.id}`);
    await page.getByRole("button", { name: "Edit meeting", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Edit meeting", exact: true });
    await dialog.getByLabel("Meeting title", { exact: true }).fill("Unsaved draft");
    await page.route(`**/api/v1/meetings/${meeting.id}`, async route => route.request().method() === "PATCH" || route.request().method() === "DELETE" ? route.fulfill({ status: 500, json: { detail: "Database unavailable" } }) : route.continue());
    await dialog.getByRole("button", { name: "Save meeting", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Database unavailable");
    await expect(dialog.getByLabel("Meeting title", { exact: true })).toHaveValue("Unsaved draft");
    expect((await request.get(`${base}/meetings/${meeting.id}`)).status()).toBe(200);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Delete meeting", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "Delete meeting?" });
    await deletion.getByRole("button", { name: "Delete meeting", exact: true }).click();
    await expect(deletion.getByRole("alert")).toHaveText("Database unavailable");
    expect((await (await request.get(`${base}/meetings/${meeting.id}`)).json()).title).toBe(meeting.title);
    await expect(page.getByText("Meeting deleted.", { exact: true })).toHaveCount(0);
  } finally { await request.delete(`${base}/meetings/${meeting.id}`); }
});

for (const width of [375, 768, 1440]) {
  test(`meeting editor layout and focus trapping at ${width}px`, async ({ page, request }) => {
    const meeting = await create(request);
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/meetings/${meeting.id}`);
      await page.getByRole("button", { name: "Edit meeting", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Edit meeting", exact: true });
      await expect(dialog.getByLabel("Meeting title", { exact: true })).toBeFocused();
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Tab");
        expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBeTruthy();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: `test-results/meeting-editor-${width}.png`, fullPage: true });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Edit meeting", exact: true })).toBeFocused();
    } finally { await request.delete(`${base}/meetings/${meeting.id}`); }
  });
}
