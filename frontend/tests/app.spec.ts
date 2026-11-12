import { test, expect, type Page } from "@playwright/test";
import { HDNodeWallet, getBytes, id } from "ethers";
import AxeBuilder from "@axe-core/playwright";

const rpc = async (method: string, params: unknown[] = []) => {
  const response = await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const result = await response.json();
  if (result.error) throw new Error(result.error.message);
  return result.result;
};

test("public lookup, document comparison, responsive layout and missing pair", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Every pair has a history." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Relay One" })).toBeVisible();
  await page.getByLabel("Pair identifier or serial code").fill("SC-PAIR-0006");
  await page.getByRole("button", { name: "Look up", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Distance Zero" }),
  ).toBeVisible();
  await expect(
    page.getByAltText("QR link to this pair’s public record"),
  ).toBeVisible();
  await page.getByLabel("File to compare").setInputFiles({
    name: "original.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("SportChain simulated certificate: SC-PAIR-0006\n"),
  });
  await page.getByRole("button", { name: "Compare file hash" }).click();
  await expect(page.getByText("Match found:", { exact: false })).toBeVisible();
  await page.getByLabel("File to compare").setInputFiles({
    name: "edited.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("changed"),
  });
  await page.getByRole("button", { name: "Compare file hash" }).click();
  await expect(page.getByText("No match:", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Distance Zero" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/lookup-mobile.png",
    fullPage: true,
  });
  await page.goto("/lookup/not-a-real-pair");
  await expect(
    page.getByRole("heading", { name: "Pair unavailable" }),
  ).toBeVisible();
  await page.goto("/manufacturer");
  await expect(
    page.getByRole("button", { name: "Register batch", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByRole("alert")).toContainText("Install MetaMask");
  expect(errors).toEqual([]);
});

test("wallet-signed browser journey, private evidence, certification and role management", async ({
  page,
}) => {
  const snapshot = await rpc("evm_snapshot");
  let index = 1;
  let rejected = false;
  let wrongNetwork = false;
  let networkSwitches = 0;
  const wallet = () =>
    HDNodeWallet.fromPhrase(
      "test test test test test test test test test test test junk",
      undefined,
      `m/44'/60'/0'/0/${index}`,
    );
  await page.exposeFunction(
    "__walletRequest",
    async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
      if (["eth_requestAccounts", "eth_accounts"].includes(method))
        return [wallet().address];
      if (method === "eth_chainId" && wrongNetwork) return "0x1";
      if (method === "wallet_switchEthereumChain") {
        expect(params).toEqual([{ chainId: "0x7a69" }]);
        wrongNetwork = false;
        networkSwitches++;
        return null;
      }
      if (method === "personal_sign")
        return wallet().signMessage(getBytes(params[0] as string));
      if (method === "eth_sendTransaction" && rejected) {
        rejected = false;
        throw new Error("User rejected the request");
      }
      return rpc(method, params);
    },
  );
  await page.addInitScript(() => {
    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
    const w = window as unknown as {
      ethereum: unknown;
      __walletRequest: (args: unknown) => Promise<unknown>;
      __walletEmit: (name: string, payload: unknown) => void;
    };
    w.ethereum = {
      request: (args: unknown) =>
        w.__walletRequest(args).catch((error: Error) => {
          if (error.message.includes("User rejected"))
            throw { code: 4001, message: "User rejected the request" };
          throw error;
        }),
      on: (name: string, fn: (...args: unknown[]) => void) =>
        (handlers[name] ||= []).push(fn),
      removeListener: (name: string, fn: (...args: unknown[]) => void) => {
        handlers[name] = (handlers[name] || []).filter((x) => x !== fn);
      },
    };
    w.__walletEmit = (name, payload) =>
      (handlers[name] || []).forEach((fn) => fn(payload));
  });
  async function connect(roleIndex: number, route: string) {
    index = roleIndex;
    await page.goto(route);
    await expect(
      page.getByRole("button", { name: /Connect wallet|0x/ }),
    ).toBeEnabled();
    await page.getByRole("button", { name: /Connect wallet|0x/ }).click();
    await expect(
      page.getByText(
        `Active ${route.slice(1) === "admin" ? "admin" : route.slice(1)} wallet`,
        { exact: false },
      ),
    ).toBeVisible();
  }
  async function confirmed() {
    await expect(
      page.getByRole("status").filter({ hasText: "Transaction confirmed" }),
    ).toBeVisible({ timeout: 20000 });
  }
  const suffix = Date.now().toString();
  const batch = `BROWSER-BATCH-${suffix}`;
  const serial = `BROWSER-PAIR-${suffix}`;
  const pid = id(serial);
  try {
    wrongNetwork = true;
    await page.goto("/manufacturer");
    await page.getByRole("button", { name: "Connect wallet" }).click();
    await expect(
      page.getByText("Active manufacturer wallet", { exact: false }),
    ).toBeVisible();
    expect(networkSwitches).toBe(1);
    await connect(1, "/manufacturer");
    await page.getByLabel("Batch code", { exact: true }).fill(batch);
    rejected = true;
    await page
      .getByRole("button", { name: "Register batch", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText("Signature declined");
    await expect(page.getByLabel("Batch code", { exact: true })).toHaveValue(
      batch,
    );
    await page
      .getByRole("button", { name: "Register batch", exact: true })
      .click();
    await confirmed();
    await page.getByLabel("Unique pair serial").fill(serial);
    await page
      .getByRole("button", { name: "Register pair", exact: true })
      .click();
    await confirmed();
    await page.goto(`/lookup/${pid}`);
    await page.getByRole("button", { name: /Connect wallet|0x/ }).click();
    await page.getByLabel("Document (maximum 10 MiB)").setInputFiles({
      name: "proof.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("browser evidence"),
    });
    await page.getByRole("button", { name: "Store file privately" }).click();
    await expect(
      page.getByRole("button", { name: "Anchor hash" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Anchor hash" }).click();
    await confirmed();
    await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
    await page.route(`**/api/products/${pid}/uploads`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Session expired" }),
      }),
    );
    await page.getByRole("button", { name: "Refresh records" }).click();
    await expect(
      page.getByRole("button", { name: "Sign in for private evidence" }),
    ).toBeVisible();
    await page.unroute(`**/api/products/${pid}/uploads`);
    await page
      .getByRole("button", { name: "Sign in for private evidence" })
      .click();
    await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
    await connect(1, "/manufacturer");
    await page.getByRole("button", { name: "Use demo recipient" }).click();
    await page
      .locator(".pair-actions")
      .filter({
        has: page.getByRole("link", { name: new RegExp(pid.slice(0, 6)) }),
      })
      .getByRole("button", { name: "Start transfer" })
      .click();
    await confirmed();
    await connect(2, "/distributor");
    const distributorRow = page.locator(".pair-actions").filter({
      has: page.getByRole("link", { name: new RegExp(pid.slice(0, 6)) }),
    });
    await distributorRow
      .getByRole("button", { name: "Confirm receipt" })
      .click();
    await confirmed();
    await page.getByRole("button", { name: "Use demo recipient" }).click();
    await distributorRow
      .getByRole("button", { name: "Start transfer" })
      .click();
    await confirmed();
    await connect(3, "/retailer");
    const retailerRow = page.locator(".pair-actions").filter({
      has: page.getByRole("link", { name: new RegExp(pid.slice(0, 6)) }),
    });
    await retailerRow.getByRole("button", { name: "Confirm receipt" }).click();
    await confirmed();
    await retailerRow
      .getByRole("button", { name: "Record sale & handover" })
      .click();
    await expect(
      page.getByText("This ends custody transfers", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm and sign" }).click();
    await confirmed();
    await connect(4, "/certifier");
    await page.getByLabel("Pair ID or serial", { exact: true }).fill(pid);
    await page.getByLabel("Exact claim").fill("Browser-tested simulated claim");
    await page.getByRole("button", { name: "Prepare manifest" }).click();
    await expect(
      page.getByRole("heading", { name: "Review the exact manifest" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Record attestation" }).click();
    await confirmed();
    await page.goto(`/lookup/${pid}`);
    await expect(
      page.getByText("Browser-tested simulated claim", { exact: true }),
    ).toBeVisible();
    await connect(0, "/admin");
    await page
      .getByLabel("Organization wallet")
      .fill(
        HDNodeWallet.fromPhrase(
          "test test test test test test test test test test test junk",
          undefined,
          "m/44'/60'/0'/0/7",
        ).address,
      );
    await page
      .getByRole("button", { name: "Review permission change" })
      .click();
    await page.getByRole("button", { name: "Confirm and sign" }).click();
    await confirmed();
  } finally {
    await rpc("evm_revert", [snapshot]);
  }
});

test("desktop overview and stakeholder routes render consistently", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Relay One" })).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  for (const route of [
    "manufacturer",
    "distributor",
    "retailer",
    "certifier",
    "admin",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator("nav a.active")).toHaveCount(1);
  }
});

test("public and stakeholder screens meet automated accessibility checks", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/lookup/SC-PAIR-0006",
    "/manufacturer",
    "/certifier",
    "/admin",
  ]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    if (route === "/")
      await expect(page.getByRole("link", { name: "Relay One" })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        description: v.description,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
