import { mkdir, writeFile } from "node:fs/promises";
import { network, artifacts } from "hardhat";

// Deploy an empty registry. Never populate product, catalog or evidence records.
const { ethers } = await network.create();
const [admin, manufacturer, distributor, retailer, certifier] =
  await ethers.getSigners();
const contract = await ethers.deployContract("SportChain", [admin.address]);
await contract.waitForDeployment();
const deployment = await contract.deploymentTransaction()!.wait();
if (!deployment) throw new Error("Deployment receipt missing");
for (const [name, signer] of [
  ["MANUFACTURER_ROLE", manufacturer],
  ["DISTRIBUTOR_ROLE", distributor],
  ["RETAILER_ROLE", retailer],
  ["CERTIFIER_ROLE", certifier],
] as const)
  await (await contract.grantRole(ethers.id(name), signer.address)).wait();
const artifact = await artifacts.readArtifact("SportChain");
await mkdir(".runtime", { recursive: true });
await writeFile(
  ".runtime/deployment.json",
  JSON.stringify(
    {
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
      pairs: [],
    },
    null,
    2,
  ),
);
console.log(
  `Empty SportChain registry deployed: ${await contract.getAddress()}\nNo sample products, batches, claims, organizations or catalog models were created.\nLocal wallet roles: accounts #0–#4.`,
);
