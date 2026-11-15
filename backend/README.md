# Backend

FastAPI service for public provenance lookup, wallet authentication, private
files and contract-event indexing.

From `backend/`, after installing dependencies and seeding the chain:

```powershell
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

SQLite is the default. Set `DATABASE_URL` for PostgreSQL; other settings are listed
in [.env.example](.env.example). Export variables explicitly. Initial tables are
created on startup.

API documentation is at http://127.0.0.1:8000/docs. Public endpoints provide models,
batches, pair records and deployment configuration. Private endpoints require a
wallet-signed login; file downloads are restricted to the original uploader.

```powershell
.venv/Scripts/python.exe -m pytest -q
```

Set `SPORTCHAIN_LIVE_TEST=1` to include integration tests against a local
Hardhat chain. These tests use isolated databases and revert their transactions.
`SPORTCHAIN_TEST_DATABASE_URL`, when set, must point to a disposable test database:
the tests drop and recreate application tables there.

See the [root README](../README.md) for installation and the [architecture notes](../docs/architecture.md)
for authentication, file confirmation and event replay behavior.
