# SportChain: A Blockchain-Based Provenance System for Athletic Footwear

CSE 540 (Fall 2026 B) course project, Group 24: Sachin, Srikar, Sushanth, Lasya.

> **Milestone:** Smart Contract Design Draft. The contract interfaces, core logic and
> documentation are in place. The backend and frontend are planned and described,
> but not built yet. Demo/test identifiers, batches, documents, verification results,
> and custody events are simulated. The planned model catalog will use cited public
> product descriptions and team-owned or appropriately licensed images.

## Project description

Counterfeit footwear enters retail channels because manufacturers, distributors and
retailers each keep separate records, and nobody can check a pair's full history.
SportChain records the life of each pair of athletic shoes on a shared ledger:

- **Registration.** A manufacturer registers a production batch of one model, then
  registers each pair in that batch with a unique ID. The QR code on the box encodes
  this ID.
- **Two-step custody transfer.** The current holder starts a transfer and the recipient
  confirms receipt. Both parties submit signed transactions for every custody handoff.
  Retailer receipt confirms distributor-to-store arrival, not customer delivery.
- **Sale and customer handover.** For this simplified prototype, `markSold()` records
  both a sale and the retailer's attestation that the pair was handed to the consumer.
  This is the proposal's retailer-attested final delivery; no buyer details are stored.
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
│   └── SportChain.ts            # Contract and authorization regression tests
├── docs/
│   ├── architecture.md          # Diagrams, role table, on-chain vs off-chain data
│   └── test-plan.md             # Implemented and planned tests
├── backend/                     # Planned FastAPI + PostgreSQL service (README only)
├── frontend/                    # Planned React + Vite dashboard (README only)
├── hardhat.config.ts
├── package.json
├── package-lock.json
├── submission.txt               # Repository URL for the link submission
└── tsconfig.json
```

## Smart contract overview

| Function | Caller | Purpose |
|---|---|---|
| `registerBatch(batchId, modelId, batchDocHash)` | Manufacturer | Create a production batch of model 1-10 |
| `registerProduct(productId, batchId)` | Manufacturer | Register one pair in the caller's batch |
| `initiateTransfer(productId, to)` | Custodian with active stage role | Start a handoff to the next stakeholder |
| `cancelTransfer(productId)` | Sender | Cancel a handoff that has not been received |
| `confirmReceipt(productId)` | Pending recipient | Accept custody |
| `markSold(productId)` | Retailer (custodian) | Attest sale and customer handover; final custody status |
| `anchorDocument(productId, docHash, docType)` | Custodian with active stage role, or certifier | Link a document hash to a pair |
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
| [Node.js](https://nodejs.org/) | 22.13+ (or a newer supported even-numbered release) | Runs Hardhat |
| [Hardhat](https://hardhat.org/) | 3.x | Compile, test, local blockchain, deploy |
| Solidity | 0.8.28 | Contract language (downloaded by Hardhat on first compile) |
| [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/5.x/) | 5.x | Audited `AccessControl` |
| ethers.js | 6.x | Contract calls from scripts and tests |
| [MetaMask](https://metamask.io/) | latest | Wallet for the planned dashboard |

Everything is free and runs locally. No public testnet or real ETH is needed.

## Setup

```bash
git clone https://github.com/SushanthOO7/SportChain.git
cd SportChain
npm ci
npx hardhat compile
```

Dependency installation and the first compile need an internet connection. `npm ci`
uses the committed lockfile for a reproducible installation. MetaMask is only needed
for the planned dashboard; contract tests and scripts run without it.

## Usage

**Run the tests**

```bash
npx hardhat test
npm run typecheck  # after compiling, checks scripts/tests against generated contract types
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
copy fails verification, and records the retailer-attested sale and customer handover.

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
| Tests | Contract test cases implemented; run `npm test` to verify. Coverage and planned checks are in [docs/test-plan.md](docs/test-plan.md) |
| FastAPI backend | Planned ([backend/README.md](backend/README.md)) |
| React dashboard and QR lookup | Planned ([frontend/README.md](frontend/README.md)) |
| Gas and latency measurements | Planned for the final report |

**Out of scope:** resale, payments, NFTs, live IoT data, oracles, public testnet and
mainnet deployment.

## Draft policies and limitations

- Forward transfers require the custodian's active role for the current stage:
  manufacturer from `Manufactured`, distributor from `AtDistributor`. Recipients
  must have the next stage's role when the transfer starts and when receipt is confirmed.
- Document anchoring requires an active certifier role, or custody plus the role for
  that custody stage. During transit the sender's previous stage applies; after sale
  the retained retailer custodian must still have `RETAILER_ROLE`.
- A sender whose role was revoked can cancel an outstanding transfer as a recovery
  action. Revocation does not erase custody or history; the admin must restore the
  appropriate role before that custodian can resume normal writes. An active pending
  recipient may still confirm an already initiated transfer after sender revocation.
- `Sold` prevents further transfers and repeated sale. Authorized evidence and claim
  verification may still be appended. The retailer remains the recorded custodian;
  consumer ownership and delivery tracking are outside this draft.
- `batchDocHash` is optional and fixed at batch registration. There is no batch hash
  update function. Later evidence is attached to individual pairs with `anchorDocument`.
- IDs use Keccak-256 (`ethers.id`); file and claim-manifest hashes use SHA-256.
  Hashing a predictable serial number does not make it secret.
- Claim hashes identify an exact UTF-8 JSON manifest containing the claim, product ID,
  and evidence hashes. See the reproducible encoding in [docs/architecture.md](docs/architecture.md#claim-manifest-encoding).

## Repository and submission

Repository: [SushanthOO7/SportChain](https://github.com/SushanthOO7/SportChain).
The root [submission.txt](submission.txt) contains only that URL for the link submission
mentioned in the supplied feedback. Push the corrected files before submitting it.
`"private": true` in `package.json` prevents npm publication; it does not control
GitHub repository visibility.
