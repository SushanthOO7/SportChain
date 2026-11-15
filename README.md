# SportChain

SportChain records athletic-footwear provenance: manufacturer registration, receipt-confirmed custody transfers, retailer sale and handover, private evidence storage, local SHA-256 comparison, and certifier attestations.

The application starts empty. There are no preloaded products, batches, organizations, catalog models, certificates, or claims. The footwear artwork is illustrative and generated from the supplied design references; it is not evidence about registered products.

## Run locally

Requirements: Node.js 22.13+ (supported even-numbered release), Python 3.11+, and MetaMask or another injected Ethereum wallet for stakeholder writes. Public lookup requires no wallet.

Install dependencies:

```bash
npm ci
npm ci --prefix frontend
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.lock
npm run compile
```

Keep three terminals open from the project root:

```bash
# Terminal 1
npm run node
```

```bash
# Terminal 2 — deploy an EMPTY registry, then start the API
npm run seed
backend/.venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

```bash
# Terminal 3
npm run frontend
```

Open http://127.0.0.1:5173. API docs: http://127.0.0.1:8000/docs. RPC: http://127.0.0.1:8545.

`npm run seed` now deploys an empty registry and assigns only local wallet permissions. It never creates catalog or business records. Running it again switches the application to a fresh registry. Restarting the local blockchain discards its state; deploy again afterward. Existing catalog and organization metadata remain in the database unless deliberately backed up and cleared.

On Windows use `npm.cmd` and `backend/.venv/Scripts/python.exe`. The PowerShell launcher `scripts/start-local.ps1` also deploys an empty registry.

## Run with Docker

Alternatively, with Docker and Docker Compose installed, start the local stack:

```bash
docker compose up --build
```

Open http://127.0.0.1:5173. Compose starts PostgreSQL, the local blockchain, registry deployment, the API, and the frontend. Stop it with `docker compose down`. Database and uploaded-file volumes persist, while restarting the blockchain requires a fresh deployment. This configuration uses development accounts and credentials.

## Wallet setup

Add SportChain Local to MetaMask: RPC `http://127.0.0.1:8545`, chain ID `31337`, currency `ETH`. Import the appropriate local Hardhat account using the development key printed by `npm run node`:

| Account | Role |
| --- | --- |
| #0 | Administrator |
| #1 | Manufacturer |
| #2 | Distributor |
| #3 | Retailer |
| #4 | Certifier |

These are public development accounts; never use them with real funds. Workspace navigation changes the screen, not the active wallet. Switching wallet accounts clears permissions and private sessions; reconnect in the app.

## Start using your own records

1. As administrator, open Administration and add your organization profiles. Names and wallets are entered by you; saving a profile does not grant blockchain permissions. Use Role Management to grant or revoke roles.
2. As manufacturer, create your catalog model. The current contract supports model slots 1–10. Register a production batch, then register its unique pairs.
3. Registration is wallet-signed. The human-readable batch/serial label is saved separately through wallet-authenticated metadata. Public serial lookup resolves the corresponding blockchain identifier.
4. Attach documents using the evidence form. Files remain private to their uploader. Sign **Anchor hash** to publish only the document fingerprint.
5. Select eligible pairs, enter an authorized distributor wallet, and initiate transfer. Each pair requires its own wallet transaction. The sender retains custody until receipt.
6. As distributor, confirm incoming receipt, select inventory, and transfer to an authorized retailer. A sender can cancel a pending transfer even after its role is revoked.
7. As retailer, confirm receipt, review the pair and permanent-operation notice, check the confirmation box, and sign sale and handover. This ends further custody transfers.
8. As certifier, look up the pair, enter the exact claim and evidence hashes, prepare the manifest, review it, select the assessment, and sign the attestation.
9. Public users can view the passport and compare a selected file's hash locally. Neither public lookup nor local comparison needs wallet sign-in.

A matching hash establishes file integrity, not physical authenticity or document truth. Attestations are attributable certifier statements. Customer identities are not stored on-chain. QR codes can be copied.

## Storage and integrations

React 19, TypeScript, Vite, React Router, ethers.js, Solidity/Hardhat, FastAPI, SQLAlchemy, and PostgreSQL or SQLite. The native default is SQLite at `backend/data/sportchain.db`; private files live under `backend/data/files`. Set `DATABASE_URL` and `STORAGE_DIR` explicitly to override them. Other settings are documented in `backend/.env.example`.

The API serves deployment ABI/address configuration, reads indexed blockchain history, and manages wallet-authenticated metadata and private uploads. Blockchain writes are always signed by the user's wallet. See [architecture notes](docs/architecture.md) for authentication, evidence manifests, and event indexing.

## Tests

```bash
npm test
npm run typecheck
npm run build:frontend
npm run format:check --prefix frontend
backend/.venv/bin/python -m pytest backend/tests -q
```

Live backend tests create their own records in temporary databases and chain snapshots:

```bash
SPORTCHAIN_LIVE_TEST=1 backend/.venv/bin/python -m pytest backend/tests -q
```

Install the browser once, then run public UI checks against the running empty application:

```bash
npm exec --prefix frontend -- playwright install chromium
npm run test:e2e --prefix frontend
```

The wallet browser test deliberately skips unless `SPORTCHAIN_TEST_API_URL` is set to a separate API using a dedicated temporary database. To run it without populating your application, start a second API at port 8001 with a temporary `DATABASE_URL` and `STORAGE_DIR`, then a second Vite server at port 5174 with `API_PROXY_URL=http://127.0.0.1:8001`. Run:

```bash
SPORTCHAIN_UI_URL=http://127.0.0.1:5174 SPORTCHAIN_TEST_API_URL=http://127.0.0.1:8001 npm run test:e2e --prefix frontend
```

Browser tests revert chain snapshots. Do not make manual transactions while live integration or browser tests are running. Keep test databases separate from application data.

## Repository contents

- `contracts/`, `ignition/`, `test/`: smart contracts, deployment modules, and contract tests.
- `backend/`: API, database models, environment example, and backend tests.
- `frontend/`: application source, active artwork, licensed fonts, and browser tests.
- `scripts/`: local deployment and Windows setup/start helpers.
- `docs/architecture.md`: architecture and evidence-manifest reference.
- `compose.yaml`, `compose.server.yaml`, and Dockerfiles: optional container setup.

Install dependencies and generate build artifacts after cloning; they are excluded from Git along with credentials, local deployments, uploads, databases, test reports, and internal planning files. Keep both npm lockfiles and `backend/requirements.lock` for reproducible installs. Back up local data separately before resetting or deleting it.

## Artwork and fonts

Footwear scenes are illustrative assets and do not certify products or imply brand affiliation. The frontend hosts Manrope, Space Grotesk, Fraunces, and Anton locally; their SIL Open Font License files are included in `frontend/public/fonts/` and must accompany redistribution.
