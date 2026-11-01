// hardhat.config.ts
// Hardhat 3 configuration for SportChain.
// All development and demos run on a local Hardhat network (free, no faucet needed).

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],

  solidity: {
    profiles: {
      // Used by `npx hardhat compile` and `npx hardhat test`
      default: {
        version: "0.8.28",
      },
      // Optimized build used for gas measurements and deployment
      production: {
        version: "0.8.28",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    },
  },

  networks: {
    // In-process simulated chain used by tests
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    // Standalone local node started with `npx hardhat node`
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
  },
});
