// scripts/demo-journey.ts
// Runs one complete simulated product journey on a running local node:
//   grant roles -> register batch + pair -> manufacturer ships -> distributor receives
//   -> distributor ships -> retailer receives -> anchor document -> verify -> sold
//
// Usage:
//   Terminal 1:  npx hardhat node
//   Terminal 2:  npx hardhat run scripts/demo-journey.ts --network localhost
//
// All IDs and documents below are simulated.

import { network } from "hardhat";

const { ethers } = await network.create();
const [admin, manufacturer, distributor, retailer, certifier] = await ethers.getSigners();

console.log("Deploying SportChain...");
const sc = await ethers.deployContract("SportChain", [admin.address]);
await sc.waitForDeployment();
console.log("SportChain deployed at:", await sc.getAddress());

// 1. Admin grants roles to the simulated stakeholders
await (await sc.grantRole(await sc.MANUFACTURER_ROLE(), manufacturer.address)).wait();
await (await sc.grantRole(await sc.DISTRIBUTOR_ROLE(), distributor.address)).wait();
await (await sc.grantRole(await sc.RETAILER_ROLE(), retailer.address)).wait();
await (await sc.grantRole(await sc.CERTIFIER_ROLE(), certifier.address)).wait();
console.log("Roles granted.");

// 2. Manufacturer registers a batch of model #1 and one pair in it
const batchId = ethers.id("BATCH-2026-RUN-001");
const pairId = ethers.id("PAIR-RUN-001-0001");
await (await sc.connect(manufacturer).registerBatch(batchId, 1, ethers.ZeroHash)).wait();
await (await sc.connect(manufacturer).registerProduct(pairId, batchId)).wait();
console.log("Registered pair:", pairId);

// 3. Two-step custody handoffs
await (await sc.connect(manufacturer).initiateTransfer(pairId, distributor.address)).wait();
await (await sc.connect(distributor).confirmReceipt(pairId)).wait();
await (await sc.connect(distributor).initiateTransfer(pairId, retailer.address)).wait();
await (await sc.connect(retailer).confirmReceipt(pairId)).wait();
console.log("Custody: manufacturer -> distributor -> retailer");

// 4. Retailer anchors a (simulated) receipt record hash; anyone can verify it
const docHash = ethers.sha256(ethers.toUtf8Bytes("simulated retailer receipt record"));
await (await sc.connect(retailer).anchorDocument(pairId, docHash, 3 /* ReceiptRecord */)).wait();
const tampered = ethers.sha256(ethers.toUtf8Bytes("simulated retailer receipt record (edited)"));
console.log("Original document verifies:", await sc.verifyDocument(pairId, docHash));
console.log("Edited document verifies:  ", await sc.verifyDocument(pairId, tampered));

// 5. Retailer marks the pair sold
await (await sc.connect(retailer).markSold(pairId)).wait();

const p = await sc.getProduct(pairId);
const names = ["None", "Manufactured", "InTransit", "AtDistributor", "AtRetailer", "Sold"];
console.log("Final status:", names[Number(p.status)], "| custodian:", p.currentCustodian);
