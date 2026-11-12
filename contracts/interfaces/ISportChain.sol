// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ISportChain {
    // InTransit retains the sender as custodian until confirmReceipt succeeds.
    enum Status {
        None,
        Manufactured,
        InTransit,
        AtDistributor,
        AtRetailer,
        Sold
    }

    enum DocType {
        ProductSpec,
        BatchRecord,
        ShippingRecord,
        ReceiptRecord,
        Certificate,
        Other
    }

    struct Batch {
        uint32 modelId;
        address manufacturer;
        uint64 producedAt;
        bytes32 batchDocHash;
    }

    struct Product {
        bytes32 batchId;
        address manufacturer;
        address currentCustodian;
        address pendingCustodian;
        Status status;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    struct DocumentRecord {
        bytes32 docHash;
        DocType docType;
        address submittedBy;
        uint64 submittedAt;
    }

    struct ClaimVerification {
        bytes32 claimHash;
        bool passed;
        address certifier;
        uint64 verifiedAt;
    }

    event BatchRegistered(bytes32 indexed batchId, uint32 indexed modelId, address indexed manufacturer, bytes32 batchDocHash);

    event ProductRegistered(bytes32 indexed productId, bytes32 indexed batchId, address indexed manufacturer);

    event TransferInitiated(bytes32 indexed productId, address indexed from, address indexed to);

    event TransferCancelled(bytes32 indexed productId, address indexed from, address indexed to);

    event ReceiptConfirmed(bytes32 indexed productId, address indexed from, address indexed to, Status newStatus);

    event DocumentAnchored(bytes32 indexed productId, bytes32 indexed docHash, DocType docType, address indexed submittedBy);

    event ClaimVerified(bytes32 indexed productId, bytes32 indexed claimHash, bool passed, address indexed certifier);

    event ProductSold(bytes32 indexed productId, address indexed retailer);

    error ZeroValue();
    error InvalidModel(uint32 modelId);
    error BatchAlreadyExists(bytes32 batchId);
    error BatchNotFound(bytes32 batchId);
    error NotBatchOwner(bytes32 batchId, address caller);
    error ProductAlreadyExists(bytes32 productId);
    error ProductNotFound(bytes32 productId);
    error NotCustodian(bytes32 productId, address caller);
    error NotPendingCustodian(bytes32 productId, address caller);
    error InvalidStatus(bytes32 productId, Status current);
    error InvalidRecipient(bytes32 productId, address to);
    error DuplicateDocument(bytes32 productId, bytes32 docHash);
    error NotAuthorizedToAnchor(bytes32 productId, address caller);

    function registerBatch(bytes32 batchId, uint32 modelId, bytes32 batchDocHash) external;

    function registerProduct(bytes32 productId, bytes32 batchId) external;

    function initiateTransfer(bytes32 productId, address to) external;

    // Cancellation remains available to the sender after role revocation.
    function cancelTransfer(bytes32 productId) external;

    function confirmReceipt(bytes32 productId) external;

    function markSold(bytes32 productId) external;

    function anchorDocument(bytes32 productId, bytes32 docHash, DocType docType) external;

    // claimHash is SHA-256 over the canonical manifest in docs/architecture.md.
    function recordClaimVerification(bytes32 productId, bytes32 claimHash, bool passed) external;

    function productExists(bytes32 productId) external view returns (bool);

    function getProduct(bytes32 productId) external view returns (Product memory);

    function getBatch(bytes32 batchId) external view returns (Batch memory);

    function getDocuments(bytes32 productId) external view returns (DocumentRecord[] memory);

    function getClaimVerifications(bytes32 productId) external view returns (ClaimVerification[] memory);

    function verifyDocument(bytes32 productId, bytes32 docHash) external view returns (bool);
}
