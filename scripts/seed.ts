import { mkdir, writeFile } from "node:fs/promises";
import { network, artifacts } from "hardhat";

const { ethers } = await network.create();
const signers = await ethers.getSigners();
const [admin, manufacturer, distributor, retailer, certifier] = signers;
const contract = await ethers.deployContract("SportChain", [admin.address]);
await contract.waitForDeployment();
const deployment = await contract.deploymentTransaction()!.wait();
if (!deployment) throw new Error("Deployment receipt missing");
const gas: { action: string; gasUsed: string }[] = [];
async function record(
  action: string,
  tx: { wait(): Promise<{ gasUsed: bigint } | null> },
) {
  const receipt = await tx.wait();
  if (!receipt) throw new Error(`Missing receipt for ${action}`);
  gas.push({ action, gasUsed: receipt.gasUsed.toString() });
}
for (const [name, signer] of [
  ["MANUFACTURER_ROLE", manufacturer],
  ["DISTRIBUTOR_ROLE", distributor],
  ["RETAILER_ROLE", retailer],
  ["CERTIFIER_ROLE", certifier],
] as const) {
  await (await contract.grantRole(ethers.id(name), signer.address)).wait();
}
const pairs: { serial: string; productId: string; modelId: number }[] = [];
for (let i = 1; i <= 6; i++) {
  const batchId = ethers.id(`SC-BATCH-${i.toString().padStart(3, "0")}`);
  const serial = `SC-PAIR-${i.toString().padStart(4, "0")}`;
  const productId = ethers.id(serial);
  pairs.push({ serial, productId, modelId: i });
  await record(
    "registerBatch",
    await contract
      .connect(manufacturer)
      .registerBatch(batchId, i, ethers.ZeroHash),
  );
  await record(
    "registerProduct",
    await contract.connect(manufacturer).registerProduct(productId, batchId),
  );
  if (i >= 2)
    await record(
      "initiateTransfer",
      await contract
        .connect(manufacturer)
        .initiateTransfer(productId, distributor.address),
    );
  if (i >= 3)
    await record(
      "confirmReceipt",
      await contract.connect(distributor).confirmReceipt(productId),
    );
  if (i >= 4)
    await record(
      "initiateTransfer",
      await contract
        .connect(distributor)
        .initiateTransfer(productId, retailer.address),
    );
  if (i >= 5)
    await record(
      "confirmReceipt",
      await contract.connect(retailer).confirmReceipt(productId),
    );
  if (i === 6) {
    const evidence = "SportChain simulated certificate: SC-PAIR-0006\n";
    const evidenceHash = ethers.sha256(ethers.toUtf8Bytes(evidence));
    await record(
      "anchorDocument",
      await contract
        .connect(certifier)
        .anchorDocument(productId, evidenceHash, 4),
    );
    const manifest = JSON.stringify({
      schema: "sportchain.claim.v1",
      productId: productId.toLowerCase(),
      claim: "Simulated material composition reviewed",
      evidenceHashes: [evidenceHash],
    });
    await record(
      "recordClaimVerification",
      await contract
        .connect(certifier)
        .recordClaimVerification(
          productId,
          ethers.sha256(ethers.toUtf8Bytes(manifest)),
          true,
        ),
    );
    await record(
      "markSold",
      await contract.connect(retailer).markSold(productId),
    );
    await mkdir(".runtime", { recursive: true });
    await writeFile(".runtime/sample-certificate.txt", evidence);
    await writeFile(".runtime/sample-claim.json", manifest);
  }
}
const artifact = await artifacts.readArtifact("SportChain");
const config = {
  chainId: Number((await ethers.provider.getNetwork()).chainId),
  address: await contract.getAddress(),
  deploymentBlock: deployment.blockNumber,
  deploymentBlockHash: deployment.blockHash,
  abi: artifact.abi,
  accounts: {
    admin: admin.address,
    manufacturer: manufacturer.address,
    distributor: distributor.address,
    retailer: retailer.address,
    certifier: certifier.address,
  },
  pairs,
};
await mkdir(".runtime", { recursive: true });
await writeFile(".runtime/deployment.json", JSON.stringify(config, null, 2));
await writeFile(
  ".runtime/gas-report.json",
  JSON.stringify(
    { buildProfile: "production", simulated: true, measurements: gas },
    null,
    2,
  ),
);
console.log(
  `SportChain seeded: ${config.address}\nDeployment configuration: .runtime/deployment.json\nSix fictional pairs: SC-PAIR-0001 through SC-PAIR-0006\nWallet roles: Hardhat accounts #0–#4 (admin, manufacturer, distributor, retailer, certifier)`,
);
