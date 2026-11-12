# SportChain

SportChain records the supply-chain history of athletic footwear. Manufacturers register batches and individual pairs, distributors and retailers confirm custody transfers, and consumers look up a pair's history through its serial number or QR code.

Documents are stored privately off-chain. Their SHA-256 hashes are recorded on the blockchain so a file can be checked for changes. Certifiers can also record pass/fail attestations against specific product claims.

CSE 540, Fall 2026 B, Group 24.

## Workflow

1. An administrator grants manufacturer, distributor, retailer and certifier roles to wallet addresses.
2. A manufacturer registers a batch and its pairs.
3. The current custodian initiates a transfer; the named recipient confirms receipt before custody changes.
4. A retailer records sale and customer handover.
5. Consumers view the timeline and compare document hashes without a wallet.

The local demo includes six fictional footwear models and sample pairs at different stages. All seeded documents and claims are simulated. A matching hash verifies file integrity; it does not prove that a document is truthful or that a physical shoe is genuine. QR codes can be copied.

## Architecture

```mermaid
flowchart LR
    Browser[React application] -->|Public reads and private evidence| API[FastAPI]
    Browser -->|Request signatures| Wallet[MetaMask]
    Wallet -->|Signed transactions| Chain[Hardhat local blockchain]
    API -->|Read state and index events| Chain
    API --> DB[(PostgreSQL or SQLite)]
    API --> Files[Private document storage]
    Chain --> Contract[SportChain Solidity contract]
```

The contract enforces roles and lifecycle transitions. The backend stores model details, files and claim manifests, and rebuilds custody history from contract events. The frontend loads the deployment address and ABI through the API; stakeholder writes are signed in MetaMask.

See [architecture notes](docs/architecture.md) for permissions, event synchronization and claim encoding.

## Stack

| Component | Technologies |
|---|---|
| Smart contract | Solidity 0.8.28, OpenZeppelin AccessControl |
| Blockchain tooling | Hardhat 3, ethers.js 6, Hardhat Ignition |
| Backend | Python, FastAPI, Uvicorn, SQLAlchemy, web3.py |
| Database | PostgreSQL; SQLite for the default local setup |
| Frontend | React 19, TypeScript, Vite, React Router |
| Wallet | MetaMask or an injected Ethereum wallet |
| Tests | Mocha/Chai, pytest, Playwright, axe-core |

## Requirements

- Node.js 22.13+ on a supported even-numbered release. Node 24 is used for development.
- Python 3.11+.
- MetaMask browser extension for stakeholder actions. Public lookup needs no wallet.
- Docker Compose for the optional container setup.

Dependency installation and the first Solidity compile require internet access. The local chain uses test ETH; no purchase is needed.

## Setup

Clone the repository and install dependencies. Run these commands in PowerShell:

```powershell
git clone https://github.com/SushanthOO7/SportChain.git
cd SportChain
npm.cmd ci
npm.cmd ci --prefix frontend
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock
npm.cmd run compile
```

On macOS/Linux, use `npm`, `python3`, and `backend/.venv/bin/python` in the equivalent commands. Both Node lockfiles and the Python dependency lockfile are committed.

### Start the local application

After installation, the Windows launcher starts the chain, deploys and seeds the contract, then starts the API and frontend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Keep that terminal open. Press Enter to stop the services it started. It refuses occupied ports and writes logs to `.runtime/`. The execution-policy setting applies only to this PowerShell process.

| Service | URL |
|---|---|
| Application | http://127.0.0.1:5173 |
| API documentation | http://127.0.0.1:8000/docs |
| Blockchain RPC | http://127.0.0.1:8545 |

The RPC address accepts JSON-RPC requests; it is not a web page.

### Manual startup

For separate terminals or non-Windows development:

```bash
# Terminal 1: keep the local chain running
npm run node
```

```bash
# Terminal 2: deploy and seed after the chain starts
npm run seed
```

```powershell
# Terminal 3: keep the API running
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
# Terminal 4: from the repository root
npm run frontend
```

On Linux/macOS, the API command is `.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from `backend/`.

Seeding writes the shared deployment configuration, sample certificate, claim manifest and gas report under `.runtime/`. Running seed again creates a new registry. Restarting the local chain discards its state; reseed before continuing.

### Database configuration

The native setup defaults to SQLite at `backend/data/sportchain.db`. Private uploads are saved under `backend/data/files`.

To use an existing PostgreSQL instance, create a database and set the connection string before starting the API:

```powershell
$env:DATABASE_URL='postgresql+psycopg://sportchain:sportchain@127.0.0.1:5432/sportchain'
```

Other settings are listed in [backend/.env.example](backend/.env.example). Export environment variables explicitly; `.env` files are not loaded automatically. Tables are created on first startup.

### Docker Compose

```bash
docker compose up --build
```

This starts PostgreSQL, Hardhat, the seed service, FastAPI and Vite. Ports bind to `127.0.0.1`. Database and document volumes persist; the local chain does not.

After recreating the chain:

```bash
docker compose up -d postgres chain
docker compose run --rm seed
docker compose up -d backend frontend
```

The native application and PostgreSQL backend have been tested. Docker Compose startup has not been verified in the development environment.

## MetaMask setup

Add a custom network:

| Setting | Value |
|---|---|
| Name | SportChain Local |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

Import the appropriate Hardhat test account using the private key printed by `npm run node`, or saved in `.runtime/chain.log` when using the launcher:

| Hardhat account | Role |
|---|---|
| #0 | Administrator |
| #1 | Manufacturer |
| #2 | Distributor |
| #3 | Retailer |
| #4 | Certifier |

These are public development keys. Never use these accounts with real funds.

In the app, open the matching stakeholder page and click **Connect wallet**. Approve account access and the network switch if prompted. Switching accounts clears the app's current permissions and private-evidence session; reconnect afterward.

A message signature signs in to the private document API. A transaction signature changes the blockchain record. The app never requests private keys.

## Try the demo

Search for `SC-PAIR-0006` on Overview. It has a completed custody timeline, a certificate hash and a certifier attestation. Compare `.runtime/sample-certificate.txt` under **Document integrity**, then edit a copy and compare again.

To run a new journey:

1. As Manufacturer, register a unique batch and pair serial.
2. Search for that serial on Overview to open its record. New pairs appear in tables under their model name and shortened blockchain ID.
3. Store a document privately, then click **Anchor hash** and sign the transaction.
4. On Manufacturer, set the distributor recipient. Below the custody table, click **Start transfer** beside your pair's ID.
5. Switch to Distributor, reconnect and confirm receipt. Start the next transfer to the retailer.
6. Switch to Retailer, reconnect and confirm store receipt, then record sale and handover.
7. Optionally use Certifier to prepare a claim manifest and record an attestation.
8. View the finished record without connecting a wallet.

An upload remains pending if its anchoring transaction is declined; retry anchoring without uploading again. QR codes link to the current application origin, so a loopback URL cannot be opened from another device.

## Tests

```powershell
# From the repository root
npm.cmd test
npm.cmd run typecheck
npm.cmd run build:frontend
npm.cmd run format:check --prefix frontend

# Backend unit tests
cd backend
.venv/Scripts/python.exe -m pytest -q
```

For backend integration tests, keep a seeded local chain running and set `SPORTCHAIN_LIVE_TEST=1` before running pytest. For browser tests, keep the chain, API and frontend running:

```powershell
# From the repository root
frontend/node_modules/.bin/playwright.cmd install chromium
npm.cmd run test:e2e --prefix frontend
```

Integration and browser tests use chain snapshots and reverts. Do not run them while making manual transactions. Tests and lockfiles belong in Git; installed dependencies, databases, uploads, keys, deployment files and test reports do not.

Gas measurements are written by `npm run seed`. Run `python scripts/measure-api.py` for local lookup latency measurements.

## Project structure

```text
contracts/          Solidity registry and interface
ignition/           Contract deployment module
backend/app/        API, database models, wallet authentication and event indexing
backend/tests/      API security and chain integration tests
frontend/src/       React pages, wallet integration and shared components
frontend/tests/     Browser and accessibility tests
scripts/            Setup, launcher, seeding, demo and measurements
test/               Smart contract tests
docs/               Architecture notes
compose.yaml        Optional local stack with PostgreSQL
```

## Limitations

SportChain is a local course prototype. Sale and customer handover are retailer-attested; buyers do not confirm receipt and their identities are not stored. Lost signing keys have no custody override. Certification records an organization's statement, not an independent inspection by the software. Payments, resale and public-network deployment are outside the project scope.
