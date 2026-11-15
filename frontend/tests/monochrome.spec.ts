import { test, expect } from "@playwright/test";
const inventory = {
  registered: 100,
  transit: 10,
  sold: 20,
  attested: 80,
  documents: 0,
  batches: 0,
  distribution: [
    { label: "At manufacturer", count: 40 },
    { label: "At distributor", count: 20 },
    { label: "At retailer", count: 10 },
    { label: "In transit", count: 10 },
    { label: "Sold", count: 20 },
  ],
  activity: [],
};

test("grayscale shell uses rainbow inventory that settles once", async ({
  page,
}) => {
  await page.route("**/api/overview", (r) => r.fulfill({ json: inventory }));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".overview-grid > .panel")).toHaveCount(2);
  await expect(
    page.getByRole("heading", { name: "Custody Status" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /Supply Chain Flow/ }),
  ).toHaveCount(0);
  const chart = page.locator(".inventory-distribution");
  await expect(chart).toHaveAttribute("data-entry-state", "settled");
  await expect(page.locator(".circular-progress-label strong")).toHaveText(
    "100",
  );
  expect(
    await page.evaluate(() =>
      [
        "--color-primary",
        "--color-dark",
        "--color-surface",
        "--color-accent",
        "--color-highlight",
      ].map((v) =>
        getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
      ),
    ),
  ).toEqual(["#c8c8c8", "#080808", "#f8f8f8", "#989898", "#686868"]);
  expect(
    await page
      .locator(".inventory-arc")
      .evaluateAll((els) =>
        els.slice(0, 4).map((el) => getComputedStyle(el).stroke),
      ),
  ).toEqual([
    "rgb(66, 133, 244)",
    "rgb(234, 67, 53)",
    "rgb(251, 188, 4)",
    "rgb(52, 168, 83)",
  ]);
  const arcs = await page
    .locator(".inventory-arc")
    .evaluateAll((els) => els.map((el) => el.getAttribute("stroke-dasharray")));
  await page.waitForTimeout(1400);
  expect(
    await page
      .locator(".inventory-arc")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("stroke-dasharray")),
      ),
  ).toEqual(arcs);
  expect(
    await chart.evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await page
    .locator(".top-tabs")
    .getByRole("link", { name: "Manufacturer", exact: true })
    .click();
  await page
    .locator(".top-tabs")
    .getByRole("link", { name: "Overview", exact: true })
    .click();
  await expect(chart).toHaveAttribute("data-entry-state", "settled");
  expect(errors).toEqual([]);
});

test("reduced motion displays final chart values without ambient motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/overview", (r) => r.fulfill({ json: inventory }));
  await page.goto("/");
  await expect(page.locator(".inventory-distribution")).toHaveAttribute(
    "data-entry-state",
    "settled",
  );
  await expect(page.locator(".circular-progress-label strong")).toHaveText(
    "100",
  );
  expect(
    await page
      .locator(".scene-shoe")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await expect(page.locator(".lookup-search .form-border-beam")).toBeHidden();
});

test("shadcn form dialog supports keyboard dismissal on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/manufacturer#register-batch");
  const dialog = page.getByRole("dialog", { name: "Register Batch" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await expect(dialog.locator("input").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/manufacturer#dashboard$/);
});

test("one border beam travels around a closed perimeter without reversing", async ({
  page,
}) => {
  await page.goto("/");
  const beam = page.locator(".lookup-search [data-beam-stroke]");
  await expect(beam).toHaveCount(1);
  await expect(beam).toHaveAttribute("pathLength", "100");
  const geometry = await beam.evaluate((el) => ({
    width: Number(el.getAttribute("width")),
    height: Number(el.getAttribute("height")),
    radius: Number(el.getAttribute("rx")),
    dashes: el.getAttribute("stroke-dasharray")!.split(" ").map(Number),
  }));
  expect(geometry.width).toBeGreaterThan(geometry.height);
  expect(geometry.radius).toBeGreaterThan(0);
  expect(geometry.dashes).toHaveLength(2);
  expect(geometry.dashes[0]).toBeLessThanOrEqual(12);
  expect(geometry.dashes[0] + geometry.dashes[1]).toBeCloseTo(100);
  const offset = () =>
    beam.evaluate((el) => parseFloat(getComputedStyle(el).strokeDashoffset));
  const first = await offset();
  await page.waitForTimeout(200);
  const second = await offset();
  await page.waitForTimeout(200);
  const third = await offset();
  // Linear clockwise movement; a modulo wrap is the continuation of the same loop.
  expect((first - second + 100) % 100).toBeGreaterThan(0);
  expect((first - second + 100) % 100).toBeLessThan(10);
  expect((second - third + 100) % 100).toBeGreaterThan(0);
  expect((second - third + 100) % 100).toBeLessThan(10);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => beam.getAttribute("width").then(Number))
    .toBeLessThan(390);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".lookup-search .form-border-beam")).toBeHidden();
});
