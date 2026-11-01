# SportChain: A Blockchain-Based Provenance System for Athletic Footwear

CSE 540 (Fall 2026 B) course project, Group 24: Sachin, Srikar, Sushanth, Lasya.

> **Milestone:** Smart Contract Design Draft. The contract interfaces, core logic and
> documentation are in place. The backend and frontend are planned and described,
> but not built yet. All data in this project is simulated.

## Project description

Counterfeit footwear enters retail channels because manufacturers, distributors and
retailers each keep separate records, and nobody can check a pair's full history.
SportChain records the life of each pair of athletic shoes on a shared ledger:

- **Registration.** A manufacturer registers a production batch of one model, then
  registers each pair in that batch with a unique ID. The QR code on the box encodes
  this ID.
- **Two-step custody transfer.** The current holder starts a transfer and the recipient
  confirms receipt. Both parties sign every handoff. The retailer's confirmation is the
  retailer-attested delivery.
- **Document anchoring.** SHA-256 hashes of off-chain documents (batch records, shipping
  records, certificates) are stored on-chain. Anyone can re-hash a file and check it. A
  mismatch shows the file was modified.
- **Optional claim verification.** A certifier can record whether a specific product claim
  (for example, a material) was confirmed.
- **Public lookup.** Consumers read a pair's status, custody history and document checks
  through free `view` calls, with no wallet and no role.

The contract enforces the rules. Only authorized roles can write. Duplicate IDs are
rejected. Pairs can only move forward (manufacturer → distributor → retailer → sold).
Every change emits an event, and the dashboard rebuilds a pair's timeline from those
events.

**What it does not prove.** A matching hash shows a record has not changed since it was
anchored. It does not prove the record's claims are true, and QR codes can be copied.
SportChain makes records tamper-evident, not truthful.

## Repository structure

```text
sportchain/
├── contracts/
│   ├── interfaces/
│   │   └── ISportChain.sol      # Types, events, errors and all function signatures
│   └── SportChain.sol           # Implementation (OpenZeppelin AccessControl)
├── ignition/
│   └── modules/
│       └── SportChain.ts        # Hardhat Ignition deployment module
├── scripts/
│   └── demo-journey.ts          # Runs one full simulated journey on a local node
├── test/
│   └── SportChain.ts            # Draft test suite (12 tests)
├── docs/
│   ├── architecture.md          # Diagrams, role table, on-chain vs off-chain data
│   └── test-plan.md             # Implemented and planned tests
├── backend/                     # Planned FastAPI + PostgreSQL service (README only)
├── frontend/                    # Planned React + Vite dashboard (README only)
├── hardhat.config.ts
├── package.json
└── tsconfig.json
```

## Smart contract overview

| Function | Caller | Purpose |
|---|---|---|
| `registerBatch(batchId, modelId, batchDocHash)` | Manufacturer | Create a production batch of model 1-10 |
| `registerProduct(productId, batchId)` | Manufacturer | Register one pair in the caller's batch |
| `initiateTransfer(productId, to)` | Current custodian | Start a handoff to the next stakeholder |
| `cancelTransfer(productId)` | Sender | Cancel a handoff that has not been received |
| `confirmReceipt(productId)` | Pending recipient | Accept custody |
| `markSold(productId)` | Retailer (custodian) | Final status; no buyer data recorded |
| `anchorDocument(productId, docHash, docType)` | Custodian or certifier | Link a document hash to a pair |
| `recordClaimVerification(productId, claimHash, passed)` | Certifier | Record a claim check |
| `getProduct`, `getBatch`, `getDocuments`, `getClaimVerifications`, `verifyDocument`, `productExists` | Anyone | Read-only lookups |

**Events:** `BatchRegistered`, `ProductRegistered`, `TransferInitiated`, `TransferCancelled`,
`ReceiptConfirmed`, `DocumentAnchored`, `ClaimVerified`, `ProductSold`.

**Roles:** `DEFAULT_ADMIN_ROLE`, `MANUFACTURER_ROLE`, `DISTRIBUTOR_ROLE`, `RETAILER_ROLE`,
`CERTIFIER_ROLE`. The full permission table and diagrams are in
[docs/architecture.md](docs/architecture.md).

## Dependencies

| Tool | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22 or newer | Runs Hardhat |
| [Hardhat](https://hardhat.org/) | 3.x | Compile, test, local blockchain, deploy |
| Solidity | 0.8.28 | Contract language (downloaded by Hardhat on first compile) |
| [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/5.x/) | 5.x | Audited `AccessControl` |
| ethers.js | 6.x | Contract calls from scripts and tests |
| [MetaMask](https://metamask.io/) | latest | Wallet for the planned dashboard |

Everything is free and runs locally. No public testnet or real ETH is needed.

## Setup

```bash
git clone https://github.com/<your-username>/sportchain.git
cd sportchain
npm install
npx hardhat compile
```

The first compile downloads the Solidity compiler, so it needs an internet connection.

## Usage

**Run the tests**

```bash
npx hardhat test
```

**Start a local blockchain** (keep this terminal open)

```bash
npx hardhat node
```

This starts a chain at `http://127.0.0.1:8545` with 20 funded test accounts.

**Run a full simulated journey** (in a second terminal)

```bash
npx hardhat run scripts/demo-journey.ts --network localhost
```

The script deploys the contract, grants roles, registers a pair, moves it from
manufacturer to distributor to retailer, anchors a document, shows that an edited
copy fails verification, and marks the pair sold.

## Deployment

Deploy to the running local node with Hardhat Ignition:

```bash
npx hardhat ignition deploy ignition/modules/SportChain.ts --network localhost
```

The deployer (account #0) becomes the admin and grants roles with
`grantRole(role, account)`. The deployed address is printed in the terminal and saved
under `ignition/deployments/`.

**Connecting MetaMask (for the planned dashboard):** add a network with RPC URL
`http://127.0.0.1:8545` and chain ID `31337`, then import one of the private keys
printed by `npx hardhat node`. These keys are public test keys; never use them on a
real network.

## Status and next steps

| Part | Status |
|---|---|
| Contract interface (`ISportChain.sol`) | Complete for this milestone |
| Contract implementation (`SportChain.sol`) | Core logic implemented; TODOs marked in code |
| Tests | 12 passing; more planned in [docs/test-plan.md](docs/test-plan.md) |
| FastAPI backend | Planned ([backend/README.md](backend/README.md)) |
| React dashboard and QR lookup | Planned ([frontend/README.md](frontend/README.md)) |
| Gas and latency measurements | Planned for the final report |

**Out of scope:** resale, payments, NFTs, live IoT data, oracles, public testnet and
mainnet deployment.
