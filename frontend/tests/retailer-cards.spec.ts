import { test, expect } from "@playwright/test";
for (const width of [1440, 1024, 390]) {
  test(`retailer cards and sale safeguards at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/retailer");
    await expect(
      page.getByRole("heading", { name: "Retailer Workspace" }),
    ).toBeVisible();
    await expect(page.locator("#incoming .count-bubble")).toHaveText("0");
    expect(
      await page
        .locator("#incoming .count-bubble")
        .evaluate((el) => getComputedStyle(el).color),
    ).toBe("rgb(200, 200, 200)");
    await expect(page.getByRole("checkbox")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Sign & Record Sale/ }),
    ).toBeDisabled();
    const search = page.getByRole("textbox", {
      name: "Search inventory",
      exact: true,
    });
    await search.fill("missing-pair");
    await expect(
      page.getByText("No matching pairs", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear inventory search" }).click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    await expect(
      page.getByText("No inventory yet", { exact: true }),
    ).toBeVisible();
    expect(
      await page.locator("#next-action").evaluate((card) => {
        const parent = card.getBoundingClientRect();
        return [...card.querySelectorAll(".panel-content > *")].every((el) => {
          const rect = el.getBoundingClientRect();
          return (
            rect.left >= parent.left + 16 && rect.right <= parent.right - 16
          );
        });
      }),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `/tmp/retailer-after-${width}.png`,
      fullPage: true,
    });
  });
}
