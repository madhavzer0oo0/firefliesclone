import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1440]) {
  test(`settings navigation, honest placeholders, and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    await expect(page.getByText("These settings are previews.", { exact: false })).toBeVisible();
    const cards = page.locator(".settings-card");
    await expect(cards).toHaveCount(6);
    for (const card of await cards.all()) {
      await expect(card.getByText("Coming Soon", { exact: true })).toBeVisible();
      await expect(card.getByRole("button")).toBeDisabled();
    }
    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page).toHaveURL(/#settings-calendar$/);
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    if (width < 1100) {
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Workspace navigation" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
    } else {
      await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("aria-current", "page");
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/settings-${width}.png`, fullPage: true });
    await page.getByRole("link", { name: "Create a meeting from a transcript →", exact: true }).click();
    await expect(page).toHaveURL("/meetings/new");
    await expect(page.getByRole("heading", { name: "Create meeting", exact: true })).toBeVisible();
  });
}
