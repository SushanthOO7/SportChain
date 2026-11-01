# SportChain Architecture

## System overview

```mermaid
flowchart LR
    subgraph USERS["Stakeholders"]
        M["Manufacturer"]
        D["Distributor"]
        R["Retailer"]
        C["Certifier (optional)"]
        CU["Consumer (read-only)"]
    end

    subgraph OFF["Off-chain layer"]
        W["MetaMask wallet"]
        UI["React + Vite dashboard<br/>React Router + ethers.js"]
        QR["QR lookup page"]
        API["FastAPI backend"]
        DB["PostgreSQL<br/>product details, file status"]
        FS["Private file storage<br/>documents"]
    end

    subgraph ON["On-chain layer: local Hardhat network"]
        SC["SportChain.sol"]
        AC["OpenZeppelin AccessControl<br/>role checks"]
        REG["Registry<br/>batch, pair, custodian, status, doc hashes"]
        EV["Event log<br/>registration, transfer, receipt, verification, sale"]
    end

    M --> W
    D --> W
    R --> W
    C --> W
    W -->|signs transactions| UI
    CU -->|scans QR code| QR

    UI -->|upload document| API
    API -->|SHA-256 hash| UI
    API --> DB
    API --> FS
    UI -->|signed transaction with hash| SC
    API -->|confirms transaction, clears pending| SC

    QR -->|read-only calls| SC
    QR -->|permitted details| API

    SC --> AC
    SC --> REG
    SC -->|emits| EV
    EV -->|history timeline| UI
    EV -->|history timeline| QR
```

## Product lifecycle

```mermaid
stateDiagram-v2
    [*] --> Manufactured: registerProduct (Manufacturer)
    Manufactured --> InTransit: initiateTransfer to Distributor
    InTransit --> AtDistributor: confirmReceipt (Distributor)
    AtDistributor --> InTransit: initiateTransfer to Retailer
    InTransit --> AtRetailer: confirmReceipt (Retailer)
    AtRetailer --> Sold: markSold (Retailer)
    InTransit --> Manufactured: cancelTransfer (sender)
    InTransit --> AtDistributor: cancelTransfer (sender)
    Sold --> [*]
```

`anchorDocument` and `recordClaimVerification` can be called at any stage after
registration. They add records but do not change the status.

## Roles and permissions

| Role | Granted by | Can call |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | constructor (deployer) | `grantRole`, `revokeRole` |
| `MANUFACTURER_ROLE` | admin | `registerBatch`, `registerProduct`, `initiateTransfer` (to a distributor), `cancelTransfer`, `anchorDocument` while custodian |
| `DISTRIBUTOR_ROLE` | admin | `confirmReceipt`, `initiateTransfer` (to a retailer), `cancelTransfer`, `anchorDocument` while custodian |
| `RETAILER_ROLE` | admin | `confirmReceipt`, `markSold`, `anchorDocument` while custodian |
| `CERTIFIER_ROLE` | admin | `recordClaimVerification`, `anchorDocument` (any pair) |
| Consumer (no role) | none | all `view` functions: `getProduct`, `getBatch`, `getDocuments`, `getClaimVerifications`, `verifyDocument`, `productExists` |

## On-chain vs. off-chain data

| Data | Where | Why |
|---|---|---|
| Pair ID, batch ID, model number | On-chain | Needed to link and look up records |
| Current and pending custodian, status, timestamps | On-chain | The provenance record that must be tamper-evident |
| SHA-256 hashes of documents and claims | On-chain | Lets anyone detect a modified file |
| Full documents (shipping records, certificates) | Off-chain, private file storage | Large and possibly confidential; storing them on-chain is costly |
| Model details, descriptions, images | Off-chain, PostgreSQL | Change often; no need for tamper evidence |
| Customer or buyer information | Not stored | Privacy; the contract records only that a pair was sold |

## Document anchoring flow

1. A participant uploads a document to the FastAPI backend.
2. The backend stores it privately, computes its SHA-256 hash, and marks it `pending`.
3. The participant submits the hash with `anchorDocument` in a MetaMask-signed transaction.
4. The backend sees the `DocumentAnchored` event and marks the file `confirmed`.
5. To verify, anyone re-hashes the file and calls `verifyDocument`. A `false` result means the file was changed or never anchored.

A matching hash shows that a file has not changed since it was anchored. It does
not prove the file's claims are true, and a QR code can be copied.
