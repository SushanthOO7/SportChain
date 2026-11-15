import { test, expect } from "@playwright/test";

test("cards retain four rounded corners and align metric rows", async ({
  page,
}) => {
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/manufacturer",
      "/distributor",
      "/retailer",
      "/certifier",
      "/admin",
      "/lookup",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      const cards = await page.locator("main .panel").evaluateAll((elements) =>
        elements.map((el) => {
          const style = getComputedStyle(el),
            box = el.getBoundingClientRect();
          return {
            corners: [
              style.borderTopLeftRadius,
              style.borderTopRightRadius,
              style.borderBottomLeftRadius,
              style.borderBottomRightRadius,
            ].map(parseFloat),
            left: box.left,
            right: box.right,
          };
        }),
      );
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(Math.min(...card.corners)).toBeGreaterThanOrEqual(18);
        expect(card.left).toBeGreaterThanOrEqual(0);
        expect(card.right).toBeLessThanOrEqual(width + 1);
      }
      if (width === 1440) {
        const heights = await page
          .locator("main > .metrics > article")
          .evaluateAll((elements) =>
            elements.map((el) => el.getBoundingClientRect().height),
          );
        if (heights.length)
          expect(
            Math.max(...heights) - Math.min(...heights),
          ).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("empty overview fits a standard desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("main h1")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(900);
});

test("role pages fit desktop and laptop browser frames", async ({ page }) => {
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1280, 800],
  ]) {
    await page.setViewportSize({ width, height });
    for (const route of [
      "manufacturer",
      "distributor",
      "retailer",
      "certifier",
      "lookup",
      "admin",
    ]) {
      await page.goto(`/${route}`);
      await expect(page.locator("main h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const size = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      expect(size.width, `${route} at ${width}×${height}`).toBeLessThanOrEqual(
        width,
      );
      expect(size.height, `${route} at ${width}×${height}`).toBeLessThanOrEqual(
        height,
      );
    }
  }
});
