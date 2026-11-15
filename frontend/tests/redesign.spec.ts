import { test, expect } from "@playwright/test";
test("mobile drawer closes with Escape and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const open = page.getByRole("button", { name: "Open navigation" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(open).toBeFocused();
  await open.click();
  await dialog.getByRole("link", { name: "Manufacturer", exact: true }).click();
  await expect(page).toHaveURL(/\/manufacturer$/);
  await expect(dialog).not.toBeVisible();
});
test("unavailable ledger shows an error without stale numeric metrics", async ({
  page,
}) => {
  await page.route("**/api/overview", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Ledger unavailable" }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Ledger unavailable");
  await expect(page.locator(".metrics strong").first()).toHaveText("—");
  await page.unroute("**/api/overview");
  await page.route("**/api/overview", (route) =>
    route.fulfill({
      json: {
        registered: 0,
        transit: 0,
        sold: 0,
        attested: 0,
        documents: 0,
        batches: 0,
        distribution: [],
        activity: [],
      },
    }),
  );
  await page.getByRole("button", { name: "Retry inventory" }).click();
  await expect(page.locator(".metrics strong").first()).toHaveText("0");
});

test("one navigation opens every workspace on desktop and mobile", async ({
  page,
}) => {
  const routes = [
    ["Overview", "/"],
    ["Pair Passport", "/lookup"],
    ["Manufacturer", "/manufacturer"],
    ["Distributor", "/distributor"],
    ["Retailer", "/retailer"],
    ["Certifier", "/certifier"],
    ["Administration", "/admin"],
  ];
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("aside.sidebar")).toHaveCount(0);
    for (const [name, path] of routes) {
      if (width <= 1200)
        await page.getByRole("button", { name: "Open navigation" }).click();
      const nav = page.getByRole("navigation", {
        name: width > 1200 ? "Workspaces" : "Main navigation",
        exact: true,
      });
      await expect(nav).toBeVisible();
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/" : path}$`));
      await expect(page.locator("main h1")).toBeVisible();
      if (width <= 1200)
        await expect(
          page.getByRole("dialog", { name: "Workspace navigation" }),
        ).not.toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () =>
          document.fonts.check('14px "Manrope"') &&
          document.fonts.check('24px "Space Grotesk"'),
      ),
    ).toBe(true);
  }
});
