import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  test(`distributor cards remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/distributor");
    await expect(page.locator("#next-action")).toBeVisible();
    await expect(page.locator("#incoming .count-bubble")).toHaveText("0");
    await expect(page.getByLabel("Retailer wallet address")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Initiate Transfer" }),
    ).toBeDisabled();
    const search = page.getByLabel("Search inventory", { exact: true });
    await search.fill("unmatched-pair");
    await expect(
      page.getByText("No matching pairs", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear inventory search" }).click();
    await expect(search).toHaveValue("");
    await expect(
      page.getByText("No inventory yet", { exact: true }),
    ).toBeVisible();
    const geometry = await page.locator("#next-action").evaluate((card) => {
      const parent = card.getBoundingClientRect();
      return [...card.querySelectorAll("input, button, ol")].every((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left >= parent.left + 16 && rect.right <= parent.right - 16;
      });
    });
    expect(geometry).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const badgeColor = await page
      .locator("#incoming .count-bubble")
      .evaluate((el) => getComputedStyle(el).color);
    expect(badgeColor).toBe("rgb(200, 200, 200)");
  });
}
