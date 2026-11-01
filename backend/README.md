# Backend (planned: FastAPI + PostgreSQL)

Not implemented in the Smart Contract Draft milestone. This folder will hold the
off-chain service described in the project proposal.

## Planned responsibilities

- Store product and model details in PostgreSQL.
- Accept document uploads and keep the files in private storage.
- Compute the SHA-256 hash of each upload and return it to the dashboard, which
  submits it on-chain with `anchorDocument`.
- Keep each file `pending` until the matching `DocumentAnchored` event is seen,
  then mark it `confirmed`.
- Serve the details a consumer is permitted to see on the QR lookup page.

## Planned stack

- Python 3.11+, FastAPI, Uvicorn
- PostgreSQL (SQLAlchemy)
- web3.py to read contract events from the local Hardhat node
