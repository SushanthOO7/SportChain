// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ISportChain} from "./interfaces/ISportChain.sol";

/**
 * @title  SportChain
 * @author Group 24 (CSE 540, Fall 2026 B)
 * @notice Provenance registry for athletic footwear. Records which batch and
 *         model each pair belongs to, who holds custody of it, its lifecycle
 *         status, and hashes of supporting documents.
 *
 * @dev    DRAFT for the Smart Contract Design milestone.
 *         - Implements every function declared in ISportChain.
 *         - Access control uses OpenZeppelin AccessControl (audited library)
 *           instead of custom role code.
 *         - History is not stored in arrays of past custodians. Every state
 *           change emits an event, and the dashboard rebuilds the timeline
 *           from event logs. This keeps storage (and gas) low.
 *         - Items marked TODO are planned for the midterm prototype.
 *
 *         Role setup: the deployer receives DEFAULT_ADMIN_ROLE and grants the
 *         other roles with grantRole(role, account). Consumers need no role.
 */
contract SportChain is ISportChain, AccessControl {
    // ─────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Registers batches and pairs; ships pairs to distributors.
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");

    /// @notice Receives pairs from manufacturers; ships pairs to retailers.
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    /// @notice Confirms delivery from distributors; marks pairs as sold.
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");

    /// @notice Optional: records claim verifications and anchors certificates.
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    /// @notice Highest valid catalog model number (the proposal scopes 5-10 models).
    uint32 public constant MAX_MODEL_ID = 10;

    // ─────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────

    /// @dev batchId => batch. A batch exists when manufacturer != address(0).
    mapping(bytes32 => Batch) private _batches;

    /// @dev productId => pair record. A pair exists when status != None.
    mapping(bytes32 => Product) private _products;

    /// @dev productId => status before the open transfer started.
    ///      Used to decide the status after confirmReceipt or cancelTransfer.
    mapping(bytes32 => Status) private _statusBeforeTransit;

    /// @dev productId => document hashes, oldest first.
    mapping(bytes32 => DocumentRecord[]) private _documents;

    /// @dev productId => docHash => anchored? Gives O(1) duplicate checks and verification.
    mapping(bytes32 => mapping(bytes32 => bool)) private _isAnchored;

    /// @dev productId => claim verifications, oldest first.
    mapping(bytes32 => ClaimVerification[]) private _claims;

    // ─────────────────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Reverts if the pair has not been registered.
    modifier productMustExist(bytes32 productId) {
        if (_products[productId].status == Status.None) revert ProductNotFound(productId);
        _;
    }

    /// @dev Reverts if the caller is not the pair's current custodian.
    modifier onlyCustodian(bytes32 productId) {
        if (_products[productId].currentCustodian != msg.sender) revert NotCustodian(productId, msg.sender);
        _;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @param admin  Account that can grant and revoke roles. In the local demo
     *               this is the first Hardhat test account.
     */
    constructor(address admin) {
        if (admin == address(0)) revert ZeroValue();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Manufacturer functions
    // ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISportChain
    function registerBatch(bytes32 batchId, uint32 modelId, bytes32 batchDocHash)
        external
        onlyRole(MANUFACTURER_ROLE)
    {
        if (batchId == bytes32(0)) revert ZeroValue();
        if (modelId == 0 || modelId > MAX_MODEL_ID) revert InvalidModel(modelId);
        if (_batches[batchId].manufacturer != address(0)) revert BatchAlreadyExists(batchId);

        _batches[batchId] = Batch({
            modelId: modelId,
            manufacturer: msg.sender,
            producedAt: uint64(block.timestamp),
            batchDocHash: batchDocHash
        });

        emit BatchRegistered(batchId, modelId, msg.sender, batchDocHash);
    }

    /// @inheritdoc ISportChain
    function registerProduct(bytes32 productId, bytes32 batchId) external onlyRole(MANUFACTURER_ROLE) {
        if (productId == bytes32(0)) revert ZeroValue();
        if (_products[productId].status != Status.None) revert ProductAlreadyExists(productId);

        Batch storage batch = _batches[batchId];
        if (batch.manufacturer == address(0)) revert BatchNotFound(batchId);
        if (batch.manufacturer != msg.sender) revert NotBatchOwner(batchId, msg.sender);

        uint64 nowTs = uint64(block.timestamp);
        _products[productId] = Product({
            batchId: batchId,
            manufacturer: msg.sender,
            currentCustodian: msg.sender,
            pendingCustodian: address(0),
            status: Status.Manufactured,
            registeredAt: nowTs,
            updatedAt: nowTs
        });

        emit ProductRegistered(productId, batchId, msg.sender);

        // TODO (midterm): add registerProducts(bytes32[] ids, bytes32 batchId)
        // so a whole batch can be registered in one transaction; compare gas.
    }

    // ─────────────────────────────────────────────────────────────────────
    // Custody functions
    // ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISportChain
    function initiateTransfer(bytes32 productId, address to)
        external
        productMustExist(productId)
        onlyCustodian(productId)
    {
        if (to == address(0)) revert ZeroValue();
        Product storage p = _products[productId];

        // Each stage may only ship forward to the next kind of stakeholder.
        if (p.status == Status.Manufactured) {
            if (!hasRole(DISTRIBUTOR_ROLE, to)) revert InvalidRecipient(productId, to);
        } else if (p.status == Status.AtDistributor) {
            if (!hasRole(RETAILER_ROLE, to)) revert InvalidRecipient(productId, to);
        } else {
            // InTransit (already moving), AtRetailer (sell instead) and Sold cannot ship.
            revert InvalidStatus(productId, p.status);
        }

        _statusBeforeTransit[productId] = p.status;
        p.pendingCustodian = to;
        p.status = Status.InTransit;
        p.updatedAt = uint64(block.timestamp);

        emit TransferInitiated(productId, msg.sender, to);
    }

    /// @inheritdoc ISportChain
    function cancelTransfer(bytes32 productId) external productMustExist(productId) onlyCustodian(productId) {
        Product storage p = _products[productId];
        if (p.status != Status.InTransit) revert InvalidStatus(productId, p.status);

        address to = p.pendingCustodian;
        p.status = _statusBeforeTransit[productId];
        p.pendingCustodian = address(0);
        p.updatedAt = uint64(block.timestamp);
        delete _statusBeforeTransit[productId];

        emit TransferCancelled(productId, msg.sender, to);
    }

    /// @inheritdoc ISportChain
    function confirmReceipt(bytes32 productId) external productMustExist(productId) {
        Product storage p = _products[productId];
        if (p.status != Status.InTransit) revert InvalidStatus(productId, p.status);
        if (p.pendingCustodian != msg.sender) revert NotPendingCustodian(productId, msg.sender);

        // Decide the new stage from the stage the pair left, and re-check the
        // role in case it was revoked while the pair was in transit.
        Status newStatus;
        if (_statusBeforeTransit[productId] == Status.Manufactured) {
            if (!hasRole(DISTRIBUTOR_ROLE, msg.sender)) revert InvalidRecipient(productId, msg.sender);
            newStatus = Status.AtDistributor;
        } else {
            if (!hasRole(RETAILER_ROLE, msg.sender)) revert InvalidRecipient(productId, msg.sender);
            newStatus = Status.AtRetailer;
        }

        address from = p.currentCustodian;
        p.currentCustodian = msg.sender;
        p.pendingCustodian = address(0);
        p.status = newStatus;
        p.updatedAt = uint64(block.timestamp);
        delete _statusBeforeTransit[productId];

        emit ReceiptConfirmed(productId, from, msg.sender, newStatus);
    }

    /// @inheritdoc ISportChain
    function markSold(bytes32 productId)
        external
        onlyRole(RETAILER_ROLE)
        productMustExist(productId)
        onlyCustodian(productId)
    {
        Product storage p = _products[productId];
        if (p.status != Status.AtRetailer) revert InvalidStatus(productId, p.status);

        p.status = Status.Sold;
        p.updatedAt = uint64(block.timestamp);

        emit ProductSold(productId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Document and claim functions
    // ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISportChain
    function anchorDocument(bytes32 productId, bytes32 docHash, DocType docType)
        external
        productMustExist(productId)
    {
        if (docHash == bytes32(0)) revert ZeroValue();
        if (_products[productId].currentCustodian != msg.sender && !hasRole(CERTIFIER_ROLE, msg.sender)) {
            revert NotAuthorizedToAnchor(productId, msg.sender);
        }
        if (_isAnchored[productId][docHash]) revert DuplicateDocument(productId, docHash);

        _isAnchored[productId][docHash] = true;
        _documents[productId].push(
            DocumentRecord({
                docHash: docHash,
                docType: docType,
                submittedBy: msg.sender,
                submittedAt: uint64(block.timestamp)
            })
        );

        emit DocumentAnchored(productId, docHash, docType, msg.sender);
    }

    /// @inheritdoc ISportChain
    function recordClaimVerification(bytes32 productId, bytes32 claimHash, bool passed)
        external
        onlyRole(CERTIFIER_ROLE)
        productMustExist(productId)
    {
        if (claimHash == bytes32(0)) revert ZeroValue();

        _claims[productId].push(
            ClaimVerification({
                claimHash: claimHash,
                passed: passed,
                certifier: msg.sender,
                verifiedAt: uint64(block.timestamp)
            })
        );

        emit ClaimVerified(productId, claimHash, passed, msg.sender);

        // TODO (midterm): decide whether a certifier may re-check the same
        // claim (current draft allows it; the latest entry is the newest result).
    }

    // ─────────────────────────────────────────────────────────────────────
    // Read-only functions
    // ─────────────────────────────────────────────────────────────────────

    /// @inheritdoc ISportChain
    function productExists(bytes32 productId) external view returns (bool) {
        return _products[productId].status != Status.None;
    }

    /// @inheritdoc ISportChain
    function getProduct(bytes32 productId) external view productMustExist(productId) returns (Product memory) {
        return _products[productId];
    }

    /// @inheritdoc ISportChain
    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        if (_batches[batchId].manufacturer == address(0)) revert BatchNotFound(batchId);
        return _batches[batchId];
    }

    /// @inheritdoc ISportChain
    function getDocuments(bytes32 productId) external view returns (DocumentRecord[] memory) {
        return _documents[productId];
    }

    /// @inheritdoc ISportChain
    function getClaimVerifications(bytes32 productId) external view returns (ClaimVerification[] memory) {
        return _claims[productId];
    }

    /// @inheritdoc ISportChain
    function verifyDocument(bytes32 productId, bytes32 docHash) external view returns (bool) {
        return _isAnchored[productId][docHash];
    }
}
