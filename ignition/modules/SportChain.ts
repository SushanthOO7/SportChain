// ignition/modules/SportChain.ts
// Hardhat Ignition deployment module for SportChain.
//
// Deploys one SportChain contract. The admin (who can grant roles) defaults to
// the first account of the network, which is Hardhat's account #0 locally.
//
// Usage (local node must be running in another terminal: `npx hardhat node`):
//   npx hardhat ignition deploy ignition/modules/SportChain.ts --network localhost

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SportChainModule", (m) => {
  const admin = m.getAccount(0);
  const sportChain = m.contract("SportChain", [admin]);
  return { sportChain };
});
