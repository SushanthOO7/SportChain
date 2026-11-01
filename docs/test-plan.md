# Test Plan

Tests live in `test/SportChain.ts` and run with `npx hardhat test`.

## Implemented in this draft (12 tests)

| Area | Test | Expected result |
|---|---|---|
| Registration | Register a pair | Manufacturer is custodian, status `Manufactured` |
| Registration | Duplicate product ID | Reverts `ProductAlreadyExists` |
| Registration | Caller without `MANUFACTURER_ROLE` | Reverts `AccessControlUnauthorizedAccount` |
| Registration | Model number outside 1-10 | Reverts `InvalidModel` |
| Custody | Full journey to `Sold` | Correct events and final status |
| Custody | Manufacturer ships directly to retailer | Reverts `InvalidRecipient` |
| Custody | Wrong account confirms receipt | Reverts `NotPendingCustodian` |
| Custody | Non-custodian starts a transfer | Reverts `NotCustodian` |
| Custody | Sender cancels an open transfer | Status restored to `Manufactured` |
| Documents | Edited file is checked | `verifyDocument` returns `false` |
| Documents | Same hash anchored twice | Reverts `DuplicateDocument` |
| Claims | Certifier records a claim | `ClaimVerified` event, one record stored |

## Planned for the midterm prototype

- Distributor ships to another distributor (should revert).
- `markSold` before the pair reaches the retailer (should revert).
- Role revoked while a pair is in transit (`confirmReceipt` should revert).
- Non-custodian, non-certifier anchors a document (should revert).
- Actions on a `Sold` pair (should revert).
- Gas cost per function, using the `production` build profile.
- Lookup latency for the dashboard under a documented local workload.
