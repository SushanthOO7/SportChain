# Frontend

React, TypeScript and Vite application with stakeholder dashboards and public pair
lookup. Wallet transactions use ethers.js; QR codes are generated locally.

From `frontend/`:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
```

Vite proxies `/api` to `http://127.0.0.1:8000`. Set `API_PROXY_URL` to change the
target. The contract ABI, address and chain ID come from `/api/config`.

Routes: `/`, `/manufacturer`, `/distributor`, `/retailer`, `/certifier`, `/admin`
and `/lookup/:code`. Lookup accepts a pair's bytes32 ID or serial code.

Wallet sessions are held in memory and cleared when the account or network
changes. The app requests a network switch when connecting to the wrong chain.
Public lookup and file comparison do not require a wallet.

With the seeded chain, API and frontend running:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run format:check
```

Browser tests cover public lookup, the signed custody journey, recovery from
expired sessions, responsive layout and automated accessibility checks. The wallet
adapter used by tests is not part of the application bundle.
