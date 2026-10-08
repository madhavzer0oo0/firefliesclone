import { test, expect } from "@playwright/test";
import type { ActionItem, Chapter, MeetingPage, Summary } from "../../src/types/api";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

test("direct detail navigation, full saved content, refresh, participants, and copy controls", async ({ page, request, context }) => {
  const library: MeetingPage = await (await request.get(`${apiUrl}/meetings`)).json();
  const meeting = library.items[0];
  const summary: Summary = await (await request.get(`${apiUrl}/meetings/${meeting.id}/summary`)).json();
  const chapters: Chapter[] = await (await request.get(`${apiUrl}/meetings/${meeting.id}/chapters`)).json();
  const actions: ActionItem[] = await (await request.get(`${apiUrl}/meetings/${meeting.id}/action-items`)).json();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByRole("heading", { name: meeting.title, exact: true })).toBeVisible();
  await expect(page.getByTestId("full-summary")).toHaveText(summary.overview);
  await expect(page.locator(".discussion-points")).toContainText(summary.notes.split(".")[0]);
  for (const chapter of chapters) await expect(page.getByText(chapter.title, { exact: true })).toBeVisible();
  for (const action of actions.slice(0, 3)) await expect(page.getByText(action.text, { exact: true })).toBeVisible();
  await page.locator(".detail-attendees > summary").click();
  for (const person of meeting.participants) await expect(page.getByText(person.email, { exact: true })).toBeVisible();
  await page.locator(".detail-attendees > summary").click();
  await expect(page.getByRole("tab", { name: /^Transcript/ })).toBeEnabled();
  await expect(page.getByRole("tab", { name: /^Action Items/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /^Share/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Edit/ })).toBeDisabled();
  await page.getByRole("button", { name: "Copy summary", exact: true }).click();
  await expect(page.getByText("Meeting summary copied to clipboard.", { exact: true })).toBeVisible();
  // The native Windows clipboard normalizes LF to CRLF; compare the saved content.
  const copiedSummary = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedSummary.replace(/\r\n/g, "\n")).toBe([meeting.title, summary.overview, summary.notes].filter(Boolean).join("\n\n"));
  await page.getByRole("button", { name: "Copy meeting link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
  const fetchedAgain = page.waitForResponse(response => response.url() === `${apiUrl}/meetings/${meeting.id}/summary` && response.ok());
  await page.getByRole("button", { name: "Refresh meeting", exact: true }).click();
  await fetchedAgain;
  await expect(page.getByTestId("full-summary")).toHaveText(summary.overview);
  await page.reload();
  await expect(page.getByTestId("full-summary")).toHaveText(summary.overview);
  const firstChapter = page.locator(".chapter-item").first();
  await firstChapter.locator("summary").click();
  await expect(firstChapter).not.toHaveAttribute("open");
  await firstChapter.locator("summary").click();
  await expect(firstChapter).toHaveAttribute("open", "");
});

test("missing meeting and invalid route identifiers", async ({ page }) => {
  await page.goto("/meetings/987654321");
  await expect(page.getByRole("heading", { name: "Meeting not found", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to meetings", exact: true }).click();
  await expect(page).toHaveURL("/meetings");
  const response = await page.goto("/meetings/not-a-number");
  expect(response?.status()).toBe(404);
});

test("empty summary, notes, chapters, and actions", async ({ page, request }) => {
  const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
  await page.route(`**/api/v1/meetings/${meeting.id}/summary`, route => route.fulfill({ status: 404, json: { detail: "Summary not found" } }));
  await page.route(`**/api/v1/meetings/${meeting.id}/chapters`, route => route.fulfill({ json: [] }));
  await page.route(`**/api/v1/meetings/${meeting.id}/action-items`, route => route.fulfill({ json: [] }));
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByText(/^No summary yet\./)).toBeVisible();
  await expect(page.getByText(/^No discussion points yet\./)).toBeVisible();
  await expect(page.getByText(/^No chapters yet\./)).toBeVisible();
  await expect(page.getByText(/^No action items yet\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy summary", exact: true })).toBeDisabled();
});

test("loading, meeting service failure, retry, and isolated summary error", async ({ page, request }) => {
  const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const url = `**/api/v1/meetings/${meeting.id}`;
  await page.route(url, async route => { await gate; await route.abort(); });
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByRole("status", { name: "Loading meeting overview" })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "We couldn’t open this meeting", exact: true })).toBeVisible();
  await page.unroute(url);
  await page.route(`**/api/v1/meetings/${meeting.id}/summary`, route => route.fulfill({ status: 500, json: { detail: "Summary service failed" } }));
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("We couldn’t load the summary. Refresh to try again.", { exact: true })).toBeVisible();
  await expect(page.locator(".chapter-item").first()).toBeVisible();
  await expect(page.locator(".action-preview-list li").first()).toBeVisible();
  await page.unroute(`**/api/v1/meetings/${meeting.id}/summary`);
  await page.getByRole("button", { name: "Refresh overview", exact: true }).click();
  await expect(page.getByTestId("full-summary")).toBeVisible();
});

for (const width of [375, 768, 1440]) {
  test(`detail responsive layout at ${width}px`, async ({ page, request }) => {
    const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/meetings/${meeting.id}`);
    await expect(page.getByTestId("full-summary")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close sidebar", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
    await page.screenshot({ path: `test-results/detail-${width}.png`, fullPage: true });
  });
}
