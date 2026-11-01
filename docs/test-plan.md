# Test Plan

Tests live in `test/SportChain.ts` and run with `npx hardhat test`.

## Implemented in this draft (29 test cases)

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

The original 12 cases above are supplemented by these 17 policy and regression cases:

| Area | Cases | Expected result |
|---|---|---|
| Sender role revocation | Manufacturer and distributor (2) | Forward transfer reverts `AccessControlUnauthorizedAccount`; no pending recipient |
| Custodian evidence permissions | Manufactured, both transit origins, distributor, retailer and sold (6) | Active stage role permits anchoring; after revocation, a new anchor reverts `NotAuthorizedToAnchor` |
| Unrelated role | Revoked manufacturer retains retailer role (1) | Cannot substitute retailer role to anchor manufacturer-stage evidence |
| Recovery | Revoked sender cancels (1) | Status and pending custodian restored; new shipment blocked until role restored |
| Recipient role revocation | Distributor and retailer in transit (2) | Receipt reverts `InvalidRecipient`; remains in transit |
| Sender revoked in transit | Active recipient receives (1) | Receipt succeeds; custody moves to recipient |
| Certifier permission | Non-custodian certifier, then revoked (1) | Active certifier anchors; revoked certifier cannot add evidence |
| Sold pair | Transfer, repeat sale, evidence/claims (3) | Transfers and repeat sale revert `InvalidStatus`; authorized evidence and claims remain appendable without custody/status changes |

Claim-verification tests hash an exact UTF-8 JSON manifest containing schema, product
ID, claim text and evidence hashes, following [architecture.md](architecture.md#claim-manifest-encoding).
Test data and results are simulated. Run `npm test` to check the current revision.

## Planned for the midterm prototype

- Distributor ships to another distributor (should revert).
- `markSold` before the pair reaches the retailer (should revert).
- Non-custodian, non-certifier anchors a document (should revert).
- Repeated receipt or cancellation after a transfer has finished (should revert).
- Gas cost per function, using the `production` build profile.
- Lookup latency for the dashboard under a documented local workload.
