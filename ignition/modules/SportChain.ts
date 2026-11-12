import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("SportChainModule", (m) => {
  const admin = m.getAccount(0);
  const sportChain = m.contract("SportChain", [admin]);
  return { sportChain };
});
