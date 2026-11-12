import { network } from "hardhat";

const { ethers } = await network.create();
const [admin, manufacturer, distributor, retailer, certifier] =
  await ethers.getSigners();

console.log("Deploying SportChain...");
const sc = await ethers.deployContract("SportChain", [admin.address]);
await sc.waitForDeployment();
console.log("SportChain deployed at:", await sc.getAddress());

await (
  await sc.grantRole(await sc.MANUFACTURER_ROLE(), manufacturer.address)
).wait();
await (
  await sc.grantRole(await sc.DISTRIBUTOR_ROLE(), distributor.address)
).wait();
await (await sc.grantRole(await sc.RETAILER_ROLE(), retailer.address)).wait();
await (await sc.grantRole(await sc.CERTIFIER_ROLE(), certifier.address)).wait();
console.log("Roles granted.");

const batchId = ethers.id("BATCH-2026-RUN-001");
const pairId = ethers.id("PAIR-RUN-001-0001");
await (
  await sc.connect(manufacturer).registerBatch(batchId, 1, ethers.ZeroHash)
).wait();
await (await sc.connect(manufacturer).registerProduct(pairId, batchId)).wait();
console.log("Registered pair:", pairId);

await (
  await sc.connect(manufacturer).initiateTransfer(pairId, distributor.address)
).wait();
await (await sc.connect(distributor).confirmReceipt(pairId)).wait();
await (
  await sc.connect(distributor).initiateTransfer(pairId, retailer.address)
).wait();
await (await sc.connect(retailer).confirmReceipt(pairId)).wait();
console.log("Custody: manufacturer -> distributor -> retailer");

const docHash = ethers.sha256(
  ethers.toUtf8Bytes("simulated retailer receipt record"),
);
await (
  await sc
    .connect(retailer)
    .anchorDocument(pairId, docHash, 3 /* ReceiptRecord */)
).wait();
const tampered = ethers.sha256(
  ethers.toUtf8Bytes("simulated retailer receipt record (edited)"),
);
console.log(
  "Original document verifies:",
  await sc.verifyDocument(pairId, docHash),
);
console.log(
  "Edited document verifies:  ",
  await sc.verifyDocument(pairId, tampered),
);

await (await sc.connect(retailer).markSold(pairId)).wait();

const p = await sc.getProduct(pairId);
const names = [
  "None",
  "Manufactured",
  "InTransit",
  "AtDistributor",
  "AtRetailer",
  "Sold",
];
console.log(
  "Final status:",
  names[Number(p.status)],
  "| custodian:",
  p.currentCustodian,
);
