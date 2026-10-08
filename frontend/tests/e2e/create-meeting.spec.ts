import { test, expect, type Page } from "@playwright/test";
import type { MeetingImportResult, MeetingPage, TranscriptSegment } from "../../src/types/api";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

async function fillDetails(page: Page, title = "E2E imported meeting") {
  await page.getByLabel("Meeting title", { exact: true }).fill(title);
  await page.getByLabel("Date and time", { exact: true }).fill("2026-10-08T10:30");
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("1");
  await page.getByLabel("Participant 1 name", { exact: true }).fill("Priya");
  await page.getByLabel("Participant 1 email", { exact: true }).fill("priya@creation.example");
}

const imports = [
  { name: "pasted timestamped text", content: "[00:00.500] Priya: Discuss the first point.\n[00:20.250] Alex: Share the second point.", label: "Priya", start: .5, source: "inferred_end" },
  { name: "pasted unstructured text", content: "An unattributed conversation.\nThe next steps were discussed.", label: "Unknown speaker", start: 0, source: "estimated" },
  { name: "TXT file", filename: "meeting.TXT", content: "[00:00.500] Priya: Discuss the first point.\n[00:20.250] Alex: Share the second point.", label: "Priya", start: .5, source: "inferred_end" },
  { name: "VTT file", filename: "meeting.vtt", content: "WEBVTT\n\n00:00.500 --> 00:15.250\n<v Priya>Discuss the first point.</v>\n\n00:20.250 --> 00:30.750\n<v Alex>Share the second point.</v>", label: "Priya", start: .5, source: "provided" },
  { name: "JSON file", filename: "meeting.json", content: JSON.stringify({ segments: [{ speaker: "Priya", start_seconds: .5, end_seconds: 15.25, text: "Discuss the first point." }, { speaker: "Alex", start_seconds: 20.25, end_seconds: 30.75, text: "Share the second point." }], summary: { overview: "Existing JSON summary.", notes: "A saved discussion point." }, action_items: [{ text: "Existing JSON task", assignee: "Priya", status: "completed" }] }), label: "Priya", start: .5, source: "provided" },
];

for (const fixture of imports) {
  test(`create using ${fixture.name}, navigate, preserve speakers/timestamps, and reload SQLite data`, async ({ page, request }) => {
    test.skip(process.env.PLAYWRIGHT_ISOLATED_DB !== "1", "Creation requires scripts/test-e2e.ps1 and its disposable SQLite database.");
    let id: number | undefined;
    try {
      await page.goto("/meetings");
      await page.getByRole("link", { name: "Create meeting", exact: true }).click();
      await expect(page).toHaveURL("/meetings/new");
      await fillDetails(page);
      await page.getByRole("button", { name: "Add participant", exact: true }).click();
      await page.getByLabel("Participant 2 name", { exact: true }).fill("Alex");
      await page.getByLabel("Participant 2 email", { exact: true }).fill("alex@creation.example");
      if (fixture.filename) {
        await page.getByRole("button", { name: "Upload file", exact: true }).click();
        await page.getByLabel("Choose transcript file", { exact: true }).setInputFiles({ name: fixture.filename, mimeType: "text/plain", buffer: Buffer.from(fixture.content) });
        await expect(page.locator(".create-upload-selected")).toHaveText(fixture.filename);
      } else {
        await page.getByLabel("Transcript text", { exact: true }).fill(fixture.content);
        await page.getByLabel("Meeting summary", { exact: true }).fill("A supplied summary, saved without AI.");
        await page.getByLabel("Action items", { exact: true }).fill("A supplied follow-up");
      }
      const createdResponse = page.waitForResponse(response => response.url() === `${apiUrl}/meetings/import` && response.status() === 201);
      await page.getByRole("button", { name: "Create meeting", exact: true }).click();
      const created = (await (await createdResponse).json()) as MeetingImportResult;
      id = created.meeting.id;
      await expect(page).toHaveURL(`/meetings/${id}`);
      await expect(page.getByRole("heading", { name: "E2E imported meeting", exact: true })).toBeVisible();
      expect(created.meeting.started_at).toBe("2026-10-08T05:00:00Z");
      await page.getByRole("tab", { name: "Transcript", exact: true }).click();
      const rows = page.getByTestId("transcript-segment");
      await expect(rows).toHaveCount(2);
      await expect(rows.first()).toContainText(fixture.label);
      await rows.first().click();
      await expect(page.getByTestId("playback-time")).toHaveAttribute("data-time", String(fixture.start));
      if (fixture.source === "estimated") await expect(page.locator(".transcript-import-note")).toContainText("Estimated timing");
      else await expect(rows.first()).toContainText("00:00.500");
      await page.reload();
      await expect(page.getByRole("heading", { name: "E2E imported meeting", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Transcript", exact: true }).click();
      await expect(rows).toHaveCount(2);
      const saved = (await (await request.get(`${apiUrl}/meetings/${id}/transcript`)).json()) as TranscriptSegment[];
      expect(saved[0]).toMatchObject({ speaker_label: fixture.label, start_seconds: fixture.start, timing_source: fixture.source });
      expect(saved[0].text).toBe(fixture.source === "estimated" ? "An unattributed conversation." : "Discuss the first point.");
      if (fixture.name === "JSON file") {
        await page.getByRole("tab", { name: "Overview", exact: true }).click();
        await expect(page.getByTestId("full-summary")).toHaveText("Existing JSON summary.");
        await page.getByRole("tab", { name: "Action Items", exact: true }).click();
        await expect(page.getByTestId("action-item")).toContainText("Existing JSON task");
        await expect(page.getByTestId("action-item").getByRole("checkbox")).toBeChecked();
      } else if (!fixture.filename) {
        await page.getByRole("tab", { name: "Overview", exact: true }).click();
        await expect(page.getByTestId("full-summary")).toHaveText("A supplied summary, saved without AI.");
        await page.getByRole("tab", { name: "Action Items", exact: true }).click();
        await expect(page.getByTestId("action-item")).toContainText("A supplied follow-up");
      }
      expect((await (await request.get(`${apiUrl}/meetings?q=E2E%20imported`)).json() as MeetingPage).items.some(meeting => meeting.id === id)).toBeTruthy();
    } finally { if (id) await request.delete(`${apiUrl}/meetings/${id}`); }
  });
}

test("required fields, participant editing, unsupported/empty/oversized/invalid-encoding files", async ({ page }) => {
  await page.goto("/meetings/new");
  await page.getByRole("button", { name: "Create meeting", exact: true }).click();
  const errors = page.locator(".create-errors");
  await expect(errors).toBeFocused();
  for (const message of ["Enter a meeting title.", "Choose a valid date and time.", "Participant 1: enter a name.", "Participant 1: enter a valid email.", "Paste a transcript before creating the meeting."]) await expect(errors).toContainText(message);
  await expect(page.getByRole("button", { name: "Remove participant 1", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Add participant", exact: true }).click();
  await page.getByRole("button", { name: "Remove participant 2", exact: true }).click();
  await expect(page.getByLabel("Participant 2 name", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  const input = page.getByLabel("Choose transcript file", { exact: true });
  for (const file of [
    { name: "wrong.pdf", buffer: Buffer.from("text"), error: "Choose a .txt, .vtt, or .json" },
    { name: "empty.txt", buffer: Buffer.from(""), error: "file is empty" },
    { name: "large.txt", buffer: Buffer.alloc(1024 * 1024 + 1, 65), error: "at most 1 MiB" },
    { name: "binary.txt", buffer: Buffer.from([0xff, 0xfe, 0x00]), error: "invalid text encoding" },
  ]) {
    await input.setInputFiles({ name: file.name, mimeType: "text/plain", buffer: file.buffer });
    await expect(page.locator(".create-file-error")).toContainText(file.error);
    await expect(page).toHaveURL("/meetings/new");
  }
});

test("invalid JSON, VTT, out-of-duration text, duplicate participants, and service failure retain drafts", async ({ page, request }) => {
  await page.goto("/meetings/new");
  await fillDetails(page, "Invalid meeting should not persist");
  const before = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).total;
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  for (const file of [{ name: "bad.json", content: "{not-json", error: "JSON must be a valid" }, { name: "bad.vtt", content: "Missing WEBVTT header", error: "VTT files must start" }]) {
    await page.getByLabel("Choose transcript file", { exact: true }).setInputFiles({ name: file.name, mimeType: "text/plain", buffer: Buffer.from(file.content) });
    await expect(page.locator(".create-upload-selected")).toHaveText(file.name);
    await page.getByRole("button", { name: "Create meeting", exact: true }).click();
    await expect(page.locator(".create-errors")).toContainText(file.error);
    await expect(page.getByLabel("Meeting title", { exact: true })).toHaveValue("Invalid meeting should not persist");
  }
  await page.getByRole("button", { name: "Paste text", exact: true }).click();
  await page.getByLabel("Transcript text", { exact: true }).fill("[01:30] Priya: Outside duration");
  await page.getByRole("button", { name: "Create meeting", exact: true }).click();
  await expect(page.locator(".create-errors")).toContainText("duration");
  await page.getByRole("button", { name: "Add participant", exact: true }).click();
  await page.getByLabel("Participant 2 name", { exact: true }).fill("Alex");
  await page.getByLabel("Participant 2 email", { exact: true }).fill("PRIYA@creation.example");
  await page.getByRole("button", { name: "Create meeting", exact: true }).click();
  await expect(page.locator(".create-errors")).toContainText("emails must be unique");
  expect(((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).total).toBe(before);
  await page.getByRole("button", { name: "Remove participant 2", exact: true }).click();
  await page.getByLabel("Transcript text", { exact: true }).fill("Keep this text after a network failure.");
  await page.route("**/api/v1/meetings/import", route => route.abort());
  await page.getByRole("button", { name: "Create meeting", exact: true }).click();
  await expect(page.locator(".create-errors")).toContainText("Couldn’t create the meeting");
  await expect(page.getByLabel("Transcript text", { exact: true })).toHaveValue("Keep this text after a network failure.");
});

for (const width of [375, 768, 1440]) {
  test(`create meeting layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/meetings");
    await expect(page.getByRole("link", { name: "Create meeting", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole("link", { name: "Create meeting", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create meeting", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/create-${width}.png`, fullPage: true });
  });
}
