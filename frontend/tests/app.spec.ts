import { test, expect, type Page } from "@playwright/test";
import { HDNodeWallet, getBytes, id, Contract, JsonRpcProvider } from "ethers";
import AxeBuilder from "@axe-core/playwright";
const rpc = async (method: string, params: unknown[] = []) => {
  const r = await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const value = await r.json();
  if (value.error) throw new Error(value.error.message);
  return value.result;
};

test("reference overview starts empty with transparent footwear imagery", async ({
  page,
}) => {
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
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Trace Every Pair Across the Supply Chain",
    }),
  ).toBeVisible();
  await expect(page.locator(".metrics strong").first()).toHaveText("0");
  await expect(
    page.getByText("No activity yet", { exact: true }),
  ).toBeVisible();
  const image = page.locator(".overview-art .scene-shoe");
  await expect(image).toBeVisible();
  expect(
    await image.evaluate(async (img) => {
      const source = img as HTMLImageElement;
      await source.decode();
      const canvas = document.createElement("canvas");
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(source, 0, 0);
      return ctx.getImageData(0, 0, 1, 1).data[3];
    }),
  ).toBe(0);
  await page.getByLabel("Pair identifier or serial code").fill("unknown-pair");
  await page.getByRole("button", { name: "Lookup Pair" }).click();
  await expect(page.getByRole("alert")).toContainText("Pair not found");
});

test("wallet journey creates only user-entered records in an isolated QA database", async ({
  page,
}) => {
  test.skip(
    !process.env.SPORTCHAIN_TEST_API_URL,
    "Wallet test requires an isolated API database; never populate the application with test records.",
  );
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

  const suffix = Date.now().toString();
  const serial = `QA-PAIR-${suffix}`;
  const batch = `QA-BATCH-${suffix}`;
  const pid = id(serial);
  async function connect(accountIndex: number, path: string) {
    index = accountIndex;
    await page.goto(path);
    await page.getByRole("button", { name: /Connect wallet|0x/ }).click();
    await expect(page.getByRole("button", { name: /0x/ })).toBeVisible();
  }
  async function confirmed() {
    await expect(
      page.getByRole("status").filter({ hasText: "Transaction confirmed" }),
    ).toBeVisible({ timeout: 20000 });
  }
  try {
    await connect(1, "/manufacturer");
    await page
      .getByRole("button", { name: "Create catalog model", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Model name", { exact: true })
      .fill(`QA running model ${suffix}`);
    await page
      .getByRole("button", { name: "Create Model", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page
      .getByRole("button", { name: "Register Batch", exact: true })
      .first()
      .click();
    await page.getByLabel("Batch code", { exact: true }).fill(batch);
    await page
      .getByLabel("Footwear model")
      .selectOption({ label: `QA running model ${suffix}` });
    rejected = true;
    await page
      .getByRole("button", { name: "Register batch", exact: true })
      .last()
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Signature declined",
    );
    await expect(page.getByLabel("Batch code", { exact: true })).toHaveValue(
      batch,
    );
    await page
      .getByRole("button", { name: "Register batch", exact: true })
      .last()
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 20000 });
    await page
      .getByRole("button", { name: "Register Pair", exact: true })
      .first()
      .click();
    await page.getByLabel("Existing batch code or ID").fill(batch);
    await page.getByLabel("Unique pair serial").fill(serial);
    await page
      .getByRole("button", { name: "Register pair", exact: true })
      .last()
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 20000 });
    await expect(
      page.getByRole("link", { name: serial, exact: true }),
    ).toBeVisible();
    await page.goto(`/lookup/${pid}`);
    await page.getByRole("button", { name: "Connect wallet" }).click();
    await page.getByLabel("Document (maximum 10 MiB)").setInputFiles({
      name: "proof.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("QA exact evidence bytes"),
    });
    await page.getByRole("button", { name: "Store file privately" }).click();
    await expect(
      page.getByRole("button", { name: "Anchor hash" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Anchor hash" }).click();
    await confirmed();
    await page.getByLabel("File to compare").setInputFiles({
      name: "proof.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("QA exact evidence bytes"),
    });
    await page.getByRole("button", { name: "Compare file hash" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Hash Match" }),
    ).toBeVisible();
    await page.getByLabel("File to compare").setInputFiles({
      name: "changed.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("different"),
    });
    await page.getByRole("button", { name: "Compare file hash" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "No Match" }),
    ).toBeVisible();
    await connect(1, "/manufacturer");
    const config = await (
      await fetch(`${process.env.SPORTCHAIN_TEST_API_URL}/api/config`)
    ).json();
    await page.getByLabel(`Select ${serial}`, { exact: true }).check();
    await page
      .getByLabel("Authorized distributor")
      .fill(config.accounts.distributor);
    await page
      .getByRole("button", { name: "Initiate Transfer", exact: true })
      .last()
      .click();
    await confirmed();
    await page
      .getByRole("button", { name: "Cancel transfer", exact: true })
      .click();
    await confirmed();
    await page.getByLabel(`Select ${serial}`, { exact: true }).check();
    await page
      .getByRole("button", { name: "Initiate Transfer", exact: true })
      .last()
      .click();
    await confirmed();
    const provider = new JsonRpcProvider("http://127.0.0.1:8545");
    const contract = new Contract(
      config.address,
      config.abi,
      await provider.getSigner(0),
    );
    await (
      await contract.revokeRole(
        id("MANUFACTURER_ROLE"),
        config.accounts.manufacturer,
      )
    ).wait();
    await connect(1, "/manufacturer");
    await page
      .getByRole("button", { name: "Cancel transfer", exact: true })
      .click();
    await confirmed();
    await (
      await contract.grantRole(
        id("MANUFACTURER_ROLE"),
        config.accounts.manufacturer,
      )
    ).wait();
    provider.destroy();
    await connect(1, "/manufacturer");
    await page.getByLabel(`Select ${serial}`, { exact: true }).check();
    await page
      .getByLabel("Authorized distributor")
      .fill(config.accounts.distributor);
    await page
      .getByRole("button", { name: "Initiate Transfer", exact: true })
      .last()
      .click();
    await confirmed();
    await connect(2, "/distributor");
    await page
      .getByRole("button", { name: "Confirm receipt", exact: true })
      .click();
    await confirmed();
    await page
      .getByLabel("Select Retailer", { exact: true })
      .fill(config.accounts.retailer);
    await page
      .getByRole("button", { name: "Initiate Transfer", exact: true })
      .click();
    await confirmed();
    await connect(3, "/retailer");
    await page
      .getByRole("button", { name: "Confirm receipt", exact: true })
      .click();
    await confirmed();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: "/tmp/reference-retailer-connected-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1672, height: 941 });
    await page.screenshot({
      path: "/tmp/reference-retailer-connected.png",
      fullPage: true,
    });
    await page
      .getByLabel("I have reviewed these details", { exact: false })
      .check();
    rejected = true;
    await page
      .getByRole("button", {
        name: "Sign & Record Sale (Permanent)",
        exact: false,
      })
      .click();
    await expect(page.getByRole("alert")).toContainText("Signature declined");
    await expect(
      page.getByLabel("I have reviewed these details", { exact: false }),
    ).toBeChecked();
    await page
      .getByRole("button", {
        name: "Sign & Record Sale (Permanent)",
        exact: false,
      })
      .click();
    await confirmed();
    await connect(4, "/certifier");
    await page.getByLabel("Pair ID or serial", { exact: true }).fill(serial);
    await page
      .getByRole("button", { name: "Look up pair", exact: true })
      .click();
    await expect(page.locator(".certifier-pair")).toContainText(serial);
    await page.getByLabel("Claim Statement").fill("QA exact claim statement");
    await page
      .getByRole("button", { name: "Prepare manifest", exact: false })
      .click();
    await page.getByLabel("Certifier's assessment").selectOption("false");
    await page
      .getByRole("button", { name: "Attest on Blockchain", exact: false })
      .click();
    await confirmed();
    await page.goto(`/lookup/${pid}`);
    await expect(
      page.getByText("QA exact claim statement", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Transfer Cancelled", { exact: true }),
    ).toHaveCount(2);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    const event = page.locator(".timeline li").first();
    await event.getByText("Transaction details", { exact: true }).click();
    await event.getByRole("button", { name: "Copy transaction hash" }).click();
    await expect(event.getByRole("status")).toHaveText("Copied");
    await connect(0, "/admin");
    await page
      .getByRole("button", { name: "Add Organization", exact: true })
      .click();
    await page
      .getByLabel("Organization name")
      .fill("QA organization entered by administrator");
    await page
      .getByLabel("Wallet address", { exact: true })
      .fill(HDNodeWallet.createRandom().address);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Add Organization", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page
        .locator(".organization-table-name")
        .getByText("QA organization entered by administrator", { exact: true })
        .last(),
    ).toBeVisible();
    await page
      .getByLabel("Select Organization / Wallet")
      .fill(config.accounts.retailer);
    await page.getByLabel("Assign Role").selectOption("RETAILER_ROLE");
    await page.getByRole("button", { name: "Grant Role", exact: true }).click();
    await page.getByRole("button", { name: "Confirm and sign" }).click();
    await confirmed();
  } finally {
    await rpc("evm_revert", [snapshot]);
  }
});

test("all reference routes fit the requested desktop and mobile widths", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1672, 1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 941 });
    for (const path of [
      "/",
      "/manufacturer",
      "/distributor",
      "/retailer",
      "/certifier",
      "/admin",
      "/lookup",
    ]) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path} at ${width}`,
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
});

test("reference screens meet automated accessibility checks", async ({
  page,
}) => {
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
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
