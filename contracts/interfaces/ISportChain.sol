// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title  ISportChain
 * @author Group 24 (CSE 540, Fall 2026 B)
 * @notice Interface for SportChain, a provenance registry for athletic footwear.
 *
 * @dev    This file is the design contract for the system. It declares every
 *         data type, event, error and function signature that the SportChain
 *         implementation must provide. The off-chain parts (FastAPI backend,
 *         React dashboard) are written against this interface.
 *
 *         Scope (from the project proposal):
 *         - 5 to 10 footwear models; each pair is linked to a model and a
 *           production batch.
 *         - Stakeholders: Manufacturer, Distributor, Retailer, optional
 *           Certifier. Consumers are read-only and need no role.
 *         - Only compact data is stored on-chain: IDs, model/batch reference,
 *           current custodian, status and SHA-256 hashes of documents. Full
 *           documents and product details stay off-chain (PostgreSQL + private
 *           file storage). No personal customer data is ever stored on-chain.
 *         - All data used in the project is simulated.
 *
 *         What the contract proves, and what it does not:
 *         A matching hash proves a document has not changed since it was
 *         anchored. It does NOT prove that the document's claims are true,
 *         and a QR code can be copied. The contract makes records
 *         tamper-evident; it cannot make them truthful.
 */
interface ISportChain {
    // ─────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Lifecycle stage of one pair of shoes.
     * @dev    Allowed transitions (enforced by the implementation):
     *
     *         Manufactured  --initiateTransfer-->  InTransit   (to a Distributor)
     *         InTransit     --confirmReceipt--->   AtDistributor
     *         AtDistributor --initiateTransfer-->  InTransit   (to a Retailer)
     *         InTransit     --confirmReceipt--->   AtRetailer
     *         AtRetailer    --markSold--------->   Sold        (final)
     *
     *         InTransit --cancelTransfer--> previous stage (sender keeps custody)
     *
     *         `None` is the default value and means "not registered".
     */
    enum Status {
        None,
        Manufactured,
        InTransit,
        AtDistributor,
        AtRetailer,
        Sold
    }

    /// @notice Kind of off-chain document whose hash is anchored on-chain.
    enum DocType {
        ProductSpec,     // model specification / material list
        BatchRecord,     // production batch record
        ShippingRecord,  // packing list, bill of lading
        ReceiptRecord,   // signed receipt at distributor or retailer
        Certificate,     // certifier's claim certificate
        Other
    }

    /**
     * @notice A production batch of one footwear model.
     * @param modelId       Catalog model number (1-10). Model details live off-chain.
     * @param manufacturer  Account that registered the batch.
     * @param producedAt    Block timestamp when the batch was registered.
     * @param batchDocHash  SHA-256 hash of the batch record (0 if none yet).
     */
    struct Batch {
        uint32 modelId;
        address manufacturer;
        uint64 producedAt;
        bytes32 batchDocHash;
    }

    /**
     * @notice On-chain record for one pair of shoes.
     * @param batchId           Batch the pair belongs to (links to its model).
     * @param manufacturer      Account that registered the pair.
     * @param currentCustodian  Account that holds custody now. During a
     *                          transfer the sender keeps custody until the
     *                          recipient confirms receipt.
     * @param pendingCustodian  Recipient of an open transfer (0 if none).
     * @param status            Current lifecycle stage.
     * @param registeredAt      Timestamp of registration.
     * @param updatedAt         Timestamp of the last state change.
     */
    struct Product {
        bytes32 batchId;
        address manufacturer;
        address currentCustodian;
        address pendingCustodian;
        Status status;
        uint64 registeredAt;
        uint64 updatedAt;
    }

    /**
     * @notice Hash of an off-chain document linked to a product.
     * @dev    The FastAPI backend computes the SHA-256 hash of the uploaded
     *         file. The participant then submits that hash in a
     *         MetaMask-signed transaction. The backend marks the file
     *         "pending" until it sees the DocumentAnchored event.
     */
    struct DocumentRecord {
        bytes32 docHash;
        DocType docType;
        address submittedBy;
        uint64 submittedAt;
    }

    /**
     * @notice Result of a certifier checking one specific claim
     *         (for example "upper is 100% recycled polyester").
     * @param claimHash  SHA-256 hash of the claim text and evidence file.
     * @param passed     True if the certifier confirmed the claim.
     */
    struct ClaimVerification {
        bytes32 claimHash;
        bool passed;
        address certifier;
        uint64 verifiedAt;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Events (the auditable history; the dashboard rebuilds timelines from these)
    // ─────────────────────────────────────────────────────────────────────

    /// @notice A manufacturer registered a new production batch.
    event BatchRegistered(bytes32 indexed batchId, uint32 indexed modelId, address indexed manufacturer, bytes32 batchDocHash);

    /// @notice A manufacturer registered a new pair of shoes.
    event ProductRegistered(bytes32 indexed productId, bytes32 indexed batchId, address indexed manufacturer);

    /// @notice The current custodian started handing the pair to `to`.
    event TransferInitiated(bytes32 indexed productId, address indexed from, address indexed to);

    /// @notice The sender cancelled an open transfer before it was received.
    event TransferCancelled(bytes32 indexed productId, address indexed from, address indexed to);

    /// @notice The recipient confirmed receipt; custody moved to `to`.
    event ReceiptConfirmed(bytes32 indexed productId, address indexed from, address indexed to, Status newStatus);

    /// @notice A document hash was linked to a product.
    event DocumentAnchored(bytes32 indexed productId, bytes32 indexed docHash, DocType docType, address indexed submittedBy);

    /// @notice A certifier recorded the result of checking a claim.
    event ClaimVerified(bytes32 indexed productId, bytes32 indexed claimHash, bool passed, address indexed certifier);

    /// @notice A retailer marked the pair as sold (no buyer data is recorded).
    event ProductSold(bytes32 indexed productId, address indexed retailer);

    // ─────────────────────────────────────────────────────────────────────
    // Errors (every rejected action reverts with one of these)
    // ─────────────────────────────────────────────────────────────────────

    error ZeroValue();                                   // an ID, hash or address was zero
    error InvalidModel(uint32 modelId);                  // model number outside 1..MAX_MODEL_ID
    error BatchAlreadyExists(bytes32 batchId);
    error BatchNotFound(bytes32 batchId);
    error NotBatchOwner(bytes32 batchId, address caller);
    error ProductAlreadyExists(bytes32 productId);       // duplicate product ID
    error ProductNotFound(bytes32 productId);
    error NotCustodian(bytes32 productId, address caller);
    error NotPendingCustodian(bytes32 productId, address caller);
    error InvalidStatus(bytes32 productId, Status current);
    error InvalidRecipient(bytes32 productId, address to); // recipient lacks the required role
    error DuplicateDocument(bytes32 productId, bytes32 docHash);
    error NotAuthorizedToAnchor(bytes32 productId, address caller);

    // ─────────────────────────────────────────────────────────────────────
    // Manufacturer functions
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a production batch for one footwear model.
     * @dev    Only MANUFACTURER_ROLE. Reverts on a zero or duplicate batch ID
     *         and on a model number outside 1..MAX_MODEL_ID.
     * @param batchId       Unique batch ID (e.g. keccak256 of the batch code).
     * @param modelId       Catalog model number.
     * @param batchDocHash  SHA-256 of the batch record; may be 0 and anchored later.
     */
    function registerBatch(bytes32 batchId, uint32 modelId, bytes32 batchDocHash) external;

    /**
     * @notice Register one pair of shoes in an existing batch.
     * @dev    Only MANUFACTURER_ROLE, and only for a batch the caller owns.
     *         Sets status to Manufactured with the caller as custodian.
     *         Reverts with ProductAlreadyExists on a duplicate ID.
     * @param productId  Unique pair ID. The QR code on the box encodes this
     *                   value. It is a hash of the serial number, so the
     *                   raw serial is never exposed on-chain.
     * @param batchId    Batch the pair belongs to.
     */
    function registerProduct(bytes32 productId, bytes32 batchId) external;

    // ─────────────────────────────────────────────────────────────────────
    // Custody functions (two-step handoff: sender initiates, recipient confirms)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Start handing a pair to the next stakeholder.
     * @dev    Caller must be the current custodian.
     *         From Manufactured the recipient must hold DISTRIBUTOR_ROLE.
     *         From AtDistributor the recipient must hold RETAILER_ROLE.
     *         Sets status to InTransit; the caller keeps custody until the
     *         recipient calls confirmReceipt.
     */
    function initiateTransfer(bytes32 productId, address to) external;

    /**
     * @notice Cancel an open transfer (e.g. a shipment was lost or misrouted).
     * @dev    Only the sender (still the current custodian). Restores the
     *         status the pair had before the transfer started.
     */
    function cancelTransfer(bytes32 productId) external;

    /**
     * @notice Confirm that a pair in transit has physically arrived.
     * @dev    Only the pending custodian. Moves custody to the caller and
     *         sets status to AtDistributor or AtRetailer, depending on the
     *         caller's role. The retailer's confirmation is the
     *         "retailer-attested delivery" described in the proposal.
     */
    function confirmReceipt(bytes32 productId) external;

    /**
     * @notice Record that a pair was sold to a consumer.
     * @dev    Only RETAILER_ROLE, only the current custodian, only from
     *         AtRetailer. Sold is final. No buyer information is recorded.
     */
    function markSold(bytes32 productId) external;

    // ─────────────────────────────────────────────────────────────────────
    // Document and claim functions
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Link the hash of an off-chain document to a pair.
     * @dev    Allowed for the current custodian or any CERTIFIER_ROLE account.
     *         Reverts with DuplicateDocument if the same hash is already
     *         linked to this pair.
     */
    function anchorDocument(bytes32 productId, bytes32 docHash, DocType docType) external;

    /**
     * @notice Record the result of checking one claim about a pair (optional step).
     * @dev    Only CERTIFIER_ROLE. Works at any stage after registration.
     *         Does not block sale: certification is claim-based, not a gate.
     */
    function recordClaimVerification(bytes32 productId, bytes32 claimHash, bool passed) external;

    // ─────────────────────────────────────────────────────────────────────
    // Read-only functions (free to call; used by the consumer QR page)
    // ─────────────────────────────────────────────────────────────────────

    /// @notice True if `productId` has been registered.
    function productExists(bytes32 productId) external view returns (bool);

    /// @notice Full on-chain record of a pair. Reverts if not registered.
    function getProduct(bytes32 productId) external view returns (Product memory);

    /// @notice Batch details. Reverts if the batch does not exist.
    function getBatch(bytes32 batchId) external view returns (Batch memory);

    /// @notice All document hashes linked to a pair, oldest first.
    function getDocuments(bytes32 productId) external view returns (DocumentRecord[] memory);

    /// @notice All claim verifications recorded for a pair, oldest first.
    function getClaimVerifications(bytes32 productId) external view returns (ClaimVerification[] memory);

    /**
     * @notice Check a document against the chain.
     * @dev    The verifier re-hashes the file off-chain and passes the result.
     *         Returns false if the file was modified (hash mismatch) or was
     *         never anchored for this pair.
     */
    function verifyDocument(bytes32 productId, bytes32 docHash) external view returns (bool);
}
