// test/SportChain.ts
// Draft test suite for SportChain (Hardhat 3 + Mocha + ethers + chai).
// Covers the main journey and the most important rejected actions.
// TODO (midterm): extend with gas measurements and remaining edge cases
// listed in docs/test-plan.md.

import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

// Status enum values, mirroring ISportChain.Status
const Status = { None: 0, Manufactured: 1, InTransit: 2, AtDistributor: 3, AtRetailer: 4, Sold: 5 };
// DocType enum values, mirroring ISportChain.DocType
const DocType = { ProductSpec: 0, BatchRecord: 1, ShippingRecord: 2, ReceiptRecord: 3, Certificate: 4, Other: 5 };

// Simulated identifiers. Real IDs are hashes of codes printed on the box / batch record.
const BATCH_ID = ethers.id("BATCH-2026-RUN-001");
const PAIR_ID = ethers.id("PAIR-RUN-001-0001");
const MODEL_ID = 1;
const DOC_HASH = ethers.sha256(ethers.toUtf8Bytes("simulated shipping record v1"));

async function deployFixture() {
  const [admin, manufacturer, distributor, retailer, certifier, consumer] = await ethers.getSigners();
  const sc = await ethers.deployContract("SportChain", [admin.address]);

  await sc.grantRole(await sc.MANUFACTURER_ROLE(), manufacturer.address);
  await sc.grantRole(await sc.DISTRIBUTOR_ROLE(), distributor.address);
  await sc.grantRole(await sc.RETAILER_ROLE(), retailer.address);
  await sc.grantRole(await sc.CERTIFIER_ROLE(), certifier.address);

  // One batch and one pair registered by the manufacturer
  await sc.connect(manufacturer).registerBatch(BATCH_ID, MODEL_ID, ethers.ZeroHash);
  await sc.connect(manufacturer).registerProduct(PAIR_ID, BATCH_ID);

  return { sc, admin, manufacturer, distributor, retailer, certifier, consumer };
}

describe("SportChain", function () {
  describe("Registration", function () {
    it("registers a pair with the manufacturer as custodian", async function () {
      const { sc, manufacturer } = await deployFixture();
      const p = await sc.getProduct(PAIR_ID);
      expect(p.currentCustodian).to.equal(manufacturer.address);
      expect(p.status).to.equal(Status.Manufactured);
      expect(p.batchId).to.equal(BATCH_ID);
    });

    it("rejects a duplicate product ID", async function () {
      const { sc, manufacturer } = await deployFixture();
      await expect(sc.connect(manufacturer).registerProduct(PAIR_ID, BATCH_ID))
        .to.be.revertedWithCustomError(sc, "ProductAlreadyExists");
    });

    it("rejects registration by an account without MANUFACTURER_ROLE", async function () {
      const { sc, consumer } = await deployFixture();
      await expect(sc.connect(consumer).registerProduct(ethers.id("PAIR-X"), BATCH_ID))
        .to.be.revertedWithCustomError(sc, "AccessControlUnauthorizedAccount");
    });

    it("rejects a model number outside the catalog", async function () {
      const { sc, manufacturer } = await deployFixture();
      await expect(sc.connect(manufacturer).registerBatch(ethers.id("BATCH-X"), 99, ethers.ZeroHash))
        .to.be.revertedWithCustomError(sc, "InvalidModel");
    });
  });

  describe("Custody journey", function () {
    it("completes manufacturer -> distributor -> retailer -> sold", async function () {
      const { sc, manufacturer, distributor, retailer } = await deployFixture();

      await expect(sc.connect(manufacturer).initiateTransfer(PAIR_ID, distributor.address))
        .to.emit(sc, "TransferInitiated").withArgs(PAIR_ID, manufacturer.address, distributor.address);
      await expect(sc.connect(distributor).confirmReceipt(PAIR_ID))
        .to.emit(sc, "ReceiptConfirmed")
        .withArgs(PAIR_ID, manufacturer.address, distributor.address, Status.AtDistributor);

      await sc.connect(distributor).initiateTransfer(PAIR_ID, retailer.address);
      await sc.connect(retailer).confirmReceipt(PAIR_ID);
      expect((await sc.getProduct(PAIR_ID)).status).to.equal(Status.AtRetailer);

      await expect(sc.connect(retailer).markSold(PAIR_ID)).to.emit(sc, "ProductSold");
      expect((await sc.getProduct(PAIR_ID)).status).to.equal(Status.Sold);
    });

    it("rejects shipping straight from manufacturer to retailer", async function () {
      const { sc, manufacturer, retailer } = await deployFixture();
      await expect(sc.connect(manufacturer).initiateTransfer(PAIR_ID, retailer.address))
        .to.be.revertedWithCustomError(sc, "InvalidRecipient");
    });

    it("rejects receipt confirmation by the wrong account", async function () {
      const { sc, manufacturer, distributor, retailer } = await deployFixture();
      await sc.connect(manufacturer).initiateTransfer(PAIR_ID, distributor.address);
      await expect(sc.connect(retailer).confirmReceipt(PAIR_ID))
        .to.be.revertedWithCustomError(sc, "NotPendingCustodian");
    });

    it("rejects transfers by a non-custodian", async function () {
      const { sc, distributor } = await deployFixture();
      await expect(sc.connect(distributor).initiateTransfer(PAIR_ID, distributor.address))
        .to.be.revertedWithCustomError(sc, "NotCustodian");
    });

    it("lets the sender cancel an open transfer", async function () {
      const { sc, manufacturer, distributor } = await deployFixture();
      await sc.connect(manufacturer).initiateTransfer(PAIR_ID, distributor.address);
      await expect(sc.connect(manufacturer).cancelTransfer(PAIR_ID)).to.emit(sc, "TransferCancelled");
      expect((await sc.getProduct(PAIR_ID)).status).to.equal(Status.Manufactured);
    });
  });

  describe("Documents and claims", function () {
    it("detects a modified document through hash mismatch", async function () {
      const { sc, manufacturer } = await deployFixture();
      await sc.connect(manufacturer).anchorDocument(PAIR_ID, DOC_HASH, DocType.ShippingRecord);

      const tampered = ethers.sha256(ethers.toUtf8Bytes("simulated shipping record v1 (edited)"));
      expect(await sc.verifyDocument(PAIR_ID, DOC_HASH)).to.equal(true);
      expect(await sc.verifyDocument(PAIR_ID, tampered)).to.equal(false);
    });

    it("rejects anchoring the same document twice", async function () {
      const { sc, manufacturer } = await deployFixture();
      await sc.connect(manufacturer).anchorDocument(PAIR_ID, DOC_HASH, DocType.ShippingRecord);
      await expect(sc.connect(manufacturer).anchorDocument(PAIR_ID, DOC_HASH, DocType.ShippingRecord))
        .to.be.revertedWithCustomError(sc, "DuplicateDocument");
    });

    it("lets a certifier record a claim verification", async function () {
      const { sc, certifier } = await deployFixture();
      // Hash the exact UTF-8 manifest bytes, including the evidence file hash.
      const manifest = JSON.stringify({
        schema: "sportchain.claim.v1",
        productId: PAIR_ID,
        claim: "upper: 100% recycled polyester",
        evidenceHashes: [DOC_HASH],
      });
      const claim = ethers.sha256(ethers.toUtf8Bytes(manifest));
      await expect(sc.connect(certifier).recordClaimVerification(PAIR_ID, claim, true))
        .to.emit(sc, "ClaimVerified").withArgs(PAIR_ID, claim, true, certifier.address);
      expect((await sc.getClaimVerifications(PAIR_ID)).length).to.equal(1);
    });
  });
});

// Move through real handoffs so authorization tests exercise each custody stage.
async function reachStage(stage: string) {
  const f = await deployFixture();
  const { sc, manufacturer, distributor, retailer } = f;
  if (stage === "Manufactured") return f;
  await sc.connect(manufacturer).initiateTransfer(PAIR_ID, distributor.address);
  if (stage === "ManufacturerInTransit") return f;
  await sc.connect(distributor).confirmReceipt(PAIR_ID);
  if (stage === "AtDistributor") return f;
  await sc.connect(distributor).initiateTransfer(PAIR_ID, retailer.address);
  if (stage === "DistributorInTransit") return f;
  await sc.connect(retailer).confirmReceipt(PAIR_ID);
  if (stage === "Sold") await sc.connect(retailer).markSold(PAIR_ID);
  return f;
}

describe("Active organizational roles", function () {
  for (const stage of ["Manufactured", "AtDistributor"]) {
    it(`rejects a forward transfer by a revoked custodian at ${stage}`, async function () {
      const { sc, manufacturer, distributor, retailer } = await reachStage(stage);
      const sender = stage === "Manufactured" ? manufacturer : distributor;
      const role = stage === "Manufactured" ? await sc.MANUFACTURER_ROLE() : await sc.DISTRIBUTOR_ROLE();
      const recipient = stage === "Manufactured" ? distributor : retailer;
      await sc.revokeRole(role, sender.address);
      await expect(sc.connect(sender).initiateTransfer(PAIR_ID, recipient.address))
        .to.be.revertedWithCustomError(sc, "AccessControlUnauthorizedAccount")
        .withArgs(sender.address, role);
      expect((await sc.getProduct(PAIR_ID)).pendingCustodian).to.equal(ethers.ZeroAddress);
    });
  }

  for (const stage of ["Manufactured", "ManufacturerInTransit", "AtDistributor", "DistributorInTransit", "AtRetailer", "Sold"]) {
    it(`rejects document anchoring by a revoked custodian at ${stage}`, async function () {
      const { sc, manufacturer, distributor, retailer } = await reachStage(stage);
      const sender = stage.startsWith("Manufactur") ? manufacturer
        : stage.includes("Distributor") ? distributor : retailer;
      const role = sender === manufacturer ? await sc.MANUFACTURER_ROLE()
        : sender === distributor ? await sc.DISTRIBUTOR_ROLE() : await sc.RETAILER_ROLE();
      const earlierHash = ethers.sha256(ethers.toUtf8Bytes("evidence before revocation"));
      await sc.connect(sender).anchorDocument(PAIR_ID, earlierHash, DocType.Other);
      expect(await sc.verifyDocument(PAIR_ID, earlierHash)).to.equal(true);
      await sc.revokeRole(role, sender.address);
      await expect(sc.connect(sender).anchorDocument(PAIR_ID, DOC_HASH, DocType.Other))
        .to.be.revertedWithCustomError(sc, "NotAuthorizedToAnchor")
        .withArgs(PAIR_ID, sender.address);
      expect(await sc.verifyDocument(PAIR_ID, DOC_HASH)).to.equal(false);
    });
  }

  it("does not substitute an unrelated organizational role for the custody role", async function () {
    const { sc, manufacturer } = await deployFixture();
    await sc.grantRole(await sc.RETAILER_ROLE(), manufacturer.address);
    await sc.revokeRole(await sc.MANUFACTURER_ROLE(), manufacturer.address);
    await expect(sc.connect(manufacturer).anchorDocument(PAIR_ID, DOC_HASH, DocType.Other))
      .to.be.revertedWithCustomError(sc, "NotAuthorizedToAnchor");
  });

  it("allows a revoked sender to cancel, but requires role restoration to ship again", async function () {
    const { sc, manufacturer, distributor } = await reachStage("ManufacturerInTransit");
    const role = await sc.MANUFACTURER_ROLE();
    await sc.revokeRole(role, manufacturer.address);
    await expect(sc.connect(manufacturer).cancelTransfer(PAIR_ID))
      .to.emit(sc, "TransferCancelled").withArgs(PAIR_ID, manufacturer.address, distributor.address);
    const p = await sc.getProduct(PAIR_ID);
    expect(p.status).to.equal(Status.Manufactured);
    expect(p.pendingCustodian).to.equal(ethers.ZeroAddress);
    expect(p.currentCustodian).to.equal(manufacturer.address);
    await expect(sc.connect(manufacturer).initiateTransfer(PAIR_ID, distributor.address))
      .to.be.revertedWithCustomError(sc, "AccessControlUnauthorizedAccount");
    await sc.grantRole(role, manufacturer.address);
    await expect(sc.connect(manufacturer).initiateTransfer(PAIR_ID, distributor.address))
      .to.emit(sc, "TransferInitiated");
  });

  for (const stage of ["ManufacturerInTransit", "DistributorInTransit"]) {
    it(`rejects receipt after the pending recipient's role is revoked at ${stage}`, async function () {
      const { sc, distributor, retailer } = await reachStage(stage);
      const recipient = stage === "ManufacturerInTransit" ? distributor : retailer;
      const role = stage === "ManufacturerInTransit" ? await sc.DISTRIBUTOR_ROLE() : await sc.RETAILER_ROLE();
      await sc.revokeRole(role, recipient.address);
      await expect(sc.connect(recipient).confirmReceipt(PAIR_ID))
        .to.be.revertedWithCustomError(sc, "InvalidRecipient");
      expect((await sc.getProduct(PAIR_ID)).status).to.equal(Status.InTransit);
    });
  }

  it("allows an active pending recipient to receive after the sender's role is revoked", async function () {
    const { sc, manufacturer, distributor } = await reachStage("ManufacturerInTransit");
    await sc.revokeRole(await sc.MANUFACTURER_ROLE(), manufacturer.address);
    await sc.connect(distributor).confirmReceipt(PAIR_ID);
    const p = await sc.getProduct(PAIR_ID);
    expect(p.status).to.equal(Status.AtDistributor);
    expect(p.currentCustodian).to.equal(distributor.address);
  });

  it("allows an active certifier to anchor independently of custody and blocks revocation", async function () {
    const { sc, certifier } = await deployFixture();
    await sc.connect(certifier).anchorDocument(PAIR_ID, DOC_HASH, DocType.Certificate);
    await sc.revokeRole(await sc.CERTIFIER_ROLE(), certifier.address);
    await expect(sc.connect(certifier).anchorDocument(PAIR_ID, ethers.sha256(ethers.toUtf8Bytes("new evidence")), DocType.Certificate))
      .to.be.revertedWithCustomError(sc, "NotAuthorizedToAnchor");
  });
});

describe("Sold products", function () {
  it("rejects further custody transfers", async function () {
    const { sc, retailer, distributor } = await reachStage("Sold");
    await expect(sc.connect(retailer).initiateTransfer(PAIR_ID, distributor.address))
      .to.be.revertedWithCustomError(sc, "InvalidStatus").withArgs(PAIR_ID, Status.Sold);
  });

  it("rejects a repeated sale and handover", async function () {
    const { sc, retailer } = await reachStage("Sold");
    await expect(sc.connect(retailer).markSold(PAIR_ID))
      .to.be.revertedWithCustomError(sc, "InvalidStatus").withArgs(PAIR_ID, Status.Sold);
  });

  it("allows authorized evidence and verification after sale without changing custody or status", async function () {
    const { sc, retailer, certifier } = await reachStage("Sold");
    await sc.connect(retailer).anchorDocument(PAIR_ID, DOC_HASH, DocType.ReceiptRecord);
    await sc.connect(certifier).anchorDocument(PAIR_ID, ethers.sha256(ethers.toUtf8Bytes("simulated certificate")), DocType.Certificate);
    const manifest = JSON.stringify({
      schema: "sportchain.claim.v1",
      productId: PAIR_ID,
      claim: "upper: 100% recycled polyester",
      evidenceHashes: [DOC_HASH],
    });
    await sc.connect(certifier).recordClaimVerification(
      PAIR_ID, ethers.sha256(ethers.toUtf8Bytes(manifest)), true,
    );
    expect(await sc.verifyDocument(PAIR_ID, DOC_HASH)).to.equal(true);
    expect((await sc.getDocuments(PAIR_ID)).length).to.equal(2);
    expect((await sc.getClaimVerifications(PAIR_ID)).length).to.equal(1);
    const p = await sc.getProduct(PAIR_ID);
    expect(p.status).to.equal(Status.Sold);
    expect(p.currentCustodian).to.equal(retailer.address);
  });
});
