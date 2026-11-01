# Frontend (planned: React + Vite dashboard)

Not implemented in the Smart Contract Draft milestone. This folder will hold the
web dashboard described in the project proposal.

## Planned pages (React Router)

| Route | User | Actions |
|---|---|---|
| `/manufacturer` | Manufacturer | Register batches and pairs, start transfers, upload documents |
| `/distributor` | Distributor | Confirm receipt, start transfers to retailers |
| `/retailer` | Retailer | Confirm receipt, mark pairs sold |
| `/certifier` | Certifier | Record claim verifications |
| `/lookup/:productId` | Consumer | QR lookup: status, custody timeline, document checks (no wallet needed) |

## Planned stack

- React + Vite, React Router
- ethers.js v6 with MetaMask for signed transactions
- The contract ABI from `artifacts/contracts/SportChain.sol/SportChain.json`
- Clear error states for reverted transactions (custom errors decoded with ethers.js)
