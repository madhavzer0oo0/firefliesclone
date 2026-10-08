import { test, expect } from "@playwright/test";
import type { MeetingPage, TranscriptSegment } from "../../src/types/api";
import { findActiveSegment, findTranscriptMatches, sortTranscriptSegments } from "../../src/lib/playback";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

test("backend transcript, seeking, clock, pause, end, tab preservation, and hidden-page pause", async ({ page, request }) => {
  const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
  const segments = sortTranscriptSegments((await (await request.get(`${apiUrl}/meetings/${meeting.id}/transcript`)).json()) as TranscriptSegment[]);
  await page.goto(`/meetings/${meeting.id}`);
  const rows = page.getByTestId("transcript-segment");
  await expect(rows).toHaveCount(segments.length);
  for (let index = 0; index < segments.length; index++) {
    await expect(rows.nth(index)).toHaveAttribute("data-segment-id", String(segments[index].id));
    await expect(rows.nth(index)).toContainText(segments[index].speaker.name);
    await expect(rows.nth(index)).toContainText(segments[index].text);
  }
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Transcript", exact: true })).toHaveAttribute("aria-selected", "true");
  const target = segments[2];
  await rows.nth(2).click();
  const elapsed = page.getByTestId("playback-time");
  await expect(elapsed).toHaveAttribute("data-time", String(target.start_seconds));
  await expect(rows.nth(2)).toHaveAttribute("data-active", "true");
  const slider = page.getByRole("slider", { name: "Seek meeting playback" });
  await slider.focus();
  await slider.press("End");
  await expect(elapsed).toHaveAttribute("data-time", String(meeting.duration_seconds));
  await expect(page.locator('[data-testid="transcript-segment"][data-active="true"]')).toHaveCount(0);
  await slider.press("Home");
  await expect(rows.first()).toHaveAttribute("data-active", "true");
  const bounds = await slider.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width * .4, bounds!.y + bounds!.height / 2);
  const seekTime = Number(await slider.inputValue());
  await expect(page.locator(`[data-segment-id="${findActiveSegment(segments, seekTime)?.id}"]`)).toHaveAttribute("data-active", "true");
  await page.clock.install();
  await page.getByRole("button", { name: "Play playback", exact: true }).click();
  await page.clock.runFor(1200);
  await page.getByRole("button", { name: "Pause playback", exact: true }).click();
  const pausedTime = Number(await elapsed.getAttribute("data-time"));
  expect(pausedTime).toBeGreaterThan(seekTime + 1);
  await page.clock.runFor(3000);
  expect(Number(await elapsed.getAttribute("data-time"))).toBe(pausedTime);
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.getByTestId("full-summary")).toBeVisible();
  expect(Number(await elapsed.getAttribute("data-time"))).toBe(pausedTime);
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  await page.getByRole("button", { name: "Refresh meeting", exact: true }).click();
  await expect(rows).toHaveCount(segments.length);
  await expect(page.getByRole("tab", { name: "Transcript", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(Number(await elapsed.getAttribute("data-time"))).toBe(pausedTime);
  await page.getByRole("button", { name: "Play playback", exact: true }).click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); Reflect.deleteProperty(document, "hidden"); });
  await expect(page.getByRole("button", { name: "Play playback", exact: true })).toBeVisible();
  const hiddenPauseTime = Number(await elapsed.getAttribute("data-time"));
  await page.clock.runFor(2000);
  expect(Number(await elapsed.getAttribute("data-time"))).toBe(hiddenPauseTime);
  // Cross a real segment boundary through playback, rather than only seeking.
  await rows.first().click();
  await page.getByRole("button", { name: "Play playback", exact: true }).click();
  await page.clock.runFor((segments[1].start_seconds + 0.5) * 1000);
  await expect(rows.nth(1)).toHaveAttribute("data-active", "true");
  await expect(rows.first()).toHaveAttribute("data-active", "false");
  const later = segments.at(-2)!;
  await page.clock.runFor((later.start_seconds - segments[1].start_seconds) * 1000);
  await expect(rows.nth(segments.length - 2)).toHaveAttribute("data-active", "true");
  await expect.poll(() => page.locator(".transcript-scroll").evaluate(element => element.scrollTop)).toBeGreaterThan(50);
  await page.getByRole("button", { name: "Pause playback", exact: true }).click();
  await rows.last().click();
  await page.getByRole("button", { name: "Play playback", exact: true }).click();
  await page.clock.runFor((meeting.duration_seconds - segments.at(-1)!.start_seconds + 1) * 1000);
  await expect(elapsed).toHaveAttribute("data-time", String(meeting.duration_seconds));
  await expect(page.getByRole("button", { name: "Play playback", exact: true })).toBeVisible();
  await expect(page).toHaveURL(`/meetings/${meeting.id}`);
});

test("literal search highlights each occurrence, wraps match navigation, and preserves meeting/tab", async ({ page, request }) => {
  const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
  const segments = sortTranscriptSegments((await (await request.get(`${apiUrl}/meetings/${meeting.id}/transcript`)).json()) as TranscriptSegment[]);
  const matches = findTranscriptMatches(segments, "meeting");
  expect(matches.length).toBeGreaterThan(1);
  await page.goto(`/meetings/${meeting.id}`);
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search transcript", exact: true });
  await search.fill("MEETING");
  await expect(page.locator(".transcript-text mark")).toHaveCount(matches.length);
  await expect(page.getByText(`1 of ${matches.length} matches`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next transcript match", exact: true }).click();
  await expect(page.getByText(`2 of ${matches.length} matches`, { exact: true })).toBeVisible();
  const target = segments.find(segment => segment.id === matches[1].segmentId)!;
  await expect(page.getByTestId("playback-time")).toHaveAttribute("data-time", String(target.start_seconds));
  await expect(page.locator('mark[data-selected="true"]')).toBeVisible();
  await page.getByRole("button", { name: "Previous transcript match", exact: true }).click();
  await page.getByRole("button", { name: "Previous transcript match", exact: true }).click();
  await expect(page.getByText(`${matches.length} of ${matches.length} matches`, { exact: true })).toBeVisible();
  await search.fill("[no-such-term]");
  await expect(page.getByText("No matches found", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next transcript match", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Clear transcript search", exact: true }).click();
  await expect(page.locator(".transcript-text mark")).toHaveCount(0);
  await expect(page.getByTestId("transcript-segment")).toHaveCount(segments.length);
  await search.fill("meeting");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.getByTestId("full-summary")).toBeVisible();
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  await expect(search).toHaveValue("meeting");
  await expect(page).toHaveURL(`/meetings/${meeting.id}`);
});

test("manual scrolling pauses follow; resuming and seeking reveal the active segment", async ({ page, request }) => {
  const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
  await page.goto(`/meetings/${meeting.id}`);
  await page.getByRole("tab", { name: "Transcript", exact: true }).click();
  const container = page.getByRole("region", { name: "Transcript segments", exact: true });
  await container.hover();
  await page.mouse.wheel(0, 1200);
  await expect(page.getByRole("button", { name: "Resume follow", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume follow", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume follow", exact: true })).toHaveCount(0);
  await expect.poll(() => container.evaluate(element => element.scrollTop)).toBeLessThan(50);
  await page.getByTestId("transcript-segment").last().click();
  await expect(page.getByTestId("transcript-segment").last()).toHaveAttribute("data-active", "true");
  await expect.poll(() => container.evaluate(element => element.scrollTop)).toBeGreaterThan(50);
});

test("transcript failure/retry and empty transcript leave the summary intact", async ({ page, request }) => {
  const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
  const url = `**/api/v1/meetings/${meeting.id}/transcript`;
  await page.route(url, route => route.fulfill({ status: 500, json: { detail: "Unavailable" } }));
  await page.goto(`/meetings/${meeting.id}`);
  await expect(page.getByTestId("full-summary")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Transcript unavailable", exact: true })).toBeVisible();
  await page.unroute(url);
  await page.getByRole("button", { name: "Retry transcript", exact: true }).click();
  await expect(page.getByTestId("transcript-segment").first()).toBeVisible();
  await page.route(url, route => route.fulfill({ json: [] }));
  await page.getByRole("button", { name: "Refresh meeting", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No transcript yet", exact: true })).toBeVisible();
  await expect(page.getByTestId("full-summary")).toBeVisible();
});

for (const width of [375, 768, 1440]) {
  test(`transcript and player layout at ${width}px`, async ({ page, request }) => {
    const meeting = ((await (await request.get(`${apiUrl}/meetings`)).json()) as MeetingPage).items[0];
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/meetings/${meeting.id}`);
    await page.getByRole("tab", { name: "Transcript", exact: true }).click();
    await expect(page.getByTestId("transcript-segment").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Play playback", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/transcript-${width}.png`, fullPage: true });
  });
}
