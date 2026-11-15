import { test, expect } from "@playwright/test";

for (const width of [1440, 1024, 390]) {
  test(`certifier controls have consistent insets and safeguards at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/certifier");
    await expect(
      page.getByRole("heading", { name: "Evaluate and Attest Authenticity" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Prepare manifest" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Attest on Blockchain" }),
    ).toBeDisabled();
    const insets = await page
      .locator(".certifier-columns > .panel")
      .evaluateAll((cards) =>
        cards.map((card) => {
          const box = card.getBoundingClientRect();
          const content = card.querySelector(".panel-content")!;
          return [...content.children].every((el) => {
            const rect = el.getBoundingClientRect();
            return rect.left >= box.left + 17 && rect.right <= box.right - 17;
          });
        }),
      );
    expect(insets).toEqual([true, true, true, true, true]);
    const lookup = page.getByRole("textbox", { name: "Pair ID or serial" });
    await lookup.fill("unknown");
    await page.getByRole("button", { name: "Clear pair lookup" }).click();
    await expect(lookup).toBeFocused();
    await page
      .getByLabel("Claim Statement")
      .fill("Verify the material origin.");
    await expect(page.locator(".character-count")).toHaveText("27 / 2000");
    await expect(
      page.getByText(
        "Connect a wallet with the certifier role to prepare a manifest.",
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("lookup gives loading and recovery feedback and the scene honors reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/products/missing-pair", async (route) => {
    await pending;
    await route.fulfill({ status: 404, json: { detail: "Pair not found" } });
  });
  await page.goto("/certifier");
  const lookup = page.getByRole("textbox", { name: "Pair ID or serial" });
  await lookup.fill("missing-pair");
  await page.getByRole("button", { name: "Look up pair", exact: true }).click();
  await expect(
    page.getByText("Looking up pair…", { exact: true }),
  ).toBeVisible();
  release();
  await expect(
    page.locator(".certifier-columns").getByRole("alert"),
  ).toContainText("Pair not found");
  await page.getByRole("button", { name: "Clear pair lookup" }).click();
  await expect(
    page.locator(".certifier-columns").getByRole("alert"),
  ).toHaveCount(0);
  for (const selector of [
    ".certifier-scene-background",
    ".certifier-scene-shoe",
  ]) {
    expect(
      await page.locator(selector).evaluate(async (el) => {
        const image = el as HTMLImageElement;
        await image.decode();
        return image.naturalWidth > 0;
      }),
    ).toBe(true);
  }
  expect(
    await page
      .locator(".certifier-scene-shoe")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});
