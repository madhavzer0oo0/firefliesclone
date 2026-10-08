import { test, expect } from "@playwright/test";
import type { MeetingPage } from "../../src/types/api";

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1";

test("live data, title/participant search, date filters, sorting, and navigation", async ({ page, request }) => {
  const response = await request.get(`${apiUrl}/meetings?limit=100`);
  expect(response.ok()).toBeTruthy();
  const all: MeetingPage = await response.json();
  expect(all.total).toBeGreaterThan(0);
  const newest = all.items[0];
  await page.goto("/meetings");
  await expect(page.getByTestId("meeting-card").first()).toHaveAttribute("data-meeting-id", String(newest.id));
  await expect(page.getByTestId("meeting-card").first()).toContainText(newest.preview ?? "No summary yet");
  const search = page.getByRole("searchbox", { name: "Search meetings by title or participant" });
  await search.fill(newest.title);
  await expect(page.getByTestId("meeting-card")).toHaveCount(1);
  await search.fill(newest.participants[0].email);
  const expected = await request.get(`${apiUrl}/meetings?search_scope=library&q=${encodeURIComponent(newest.participants[0].email)}`);
  const participantPage: MeetingPage = await expected.json();
  await expect(page.getByTestId("meeting-card")).toHaveCount(participantPage.total);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Filter by participant").fill(newest.participants[0].email);
  await expect(page.getByTestId("meeting-card")).toHaveCount(participantPage.total);
  await page.getByRole("button", { name: "Clear all filters", exact: true }).click();
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(newest.started_at));
  await page.getByLabel("Start date", { exact: true }).fill(localDate);
  await page.getByLabel("End date", { exact: true }).fill(localDate);
  const sameDay = all.items.filter(item => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.started_at)) === localDate);
  await expect(page.getByTestId("meeting-card")).toHaveCount(sameDay.length);
  await page.getByLabel("End date", { exact: true }).fill("2000-01-01");
  await expect(page.getByText("End date must be on or after start date.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByLabel("Sort meetings by recency").selectOption("asc");
  const oldestPage: MeetingPage = await (await request.get(`${apiUrl}/meetings?order=asc&limit=12`)).json();
  await expect(page.getByTestId("meeting-card").first()).toHaveAttribute("data-meeting-id", String(oldestPage.items[0].id));
  await page.getByRole("link", { name: `Open ${oldestPage.items[0].title}`, exact: true }).click();
  await expect(page).toHaveURL(`/meetings/${oldestPage.items[0].id}`);
  await expect(page.getByRole("heading", { name: oldestPage.items[0].title, exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("empty search, reset, settings toast, and keyboard shortcut", async ({ page }) => {
  await page.goto("/meetings");
  await expect(page.getByTestId("meeting-card").first()).toBeVisible();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("searchbox");
  await expect(search).toBeFocused();
  await search.fill("unlikely-no-such-meeting-982341");
  await expect(page.getByRole("heading", { name: "No matching meetings" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  await expect(page.getByTestId("meeting-card").first()).toBeVisible();
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  await expect(page.getByText("Workspace settings are coming soon.", { exact: true })).toBeVisible();
});

test("loading skeletons and recovery after backend failure", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/meetings?*", async route => { await gate; await route.abort("failed"); });
  await page.goto("/meetings");
  await expect(page.getByRole("status", { name: "Loading meetings" })).toBeVisible();
  release();
  await expect(page.getByRole("heading", { name: "Let’s try that again" })).toBeVisible();
  await page.unroute("**/api/v1/meetings?*");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("meeting-card").first()).toBeVisible();
});

for (const width of [375, 768, 1440]) {
  test(`responsive layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/meetings");
    await expect(page.getByTestId("meeting-card").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    if (width < 900) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Close sidebar" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
    }
    await page.screenshot({ path: `test-results/meetings-${width}.png`, fullPage: true });
  });
}
