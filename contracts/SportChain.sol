// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ISportChain} from "./interfaces/ISportChain.sol";

contract SportChain is ISportChain, AccessControl {
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");

    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");

    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");

    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    uint32 public constant MAX_MODEL_ID = 10;

    mapping(bytes32 => Batch) private _batches;

    mapping(bytes32 => Product) private _products;

    mapping(bytes32 => Status) private _statusBeforeTransit;

    mapping(bytes32 => DocumentRecord[]) private _documents;

    mapping(bytes32 => mapping(bytes32 => bool)) private _isAnchored;

    mapping(bytes32 => ClaimVerification[]) private _claims;

    modifier productMustExist(bytes32 productId) {
        if (_products[productId].status == Status.None) revert ProductNotFound(productId);
        _;
    }

    modifier onlyCustodian(bytes32 productId) {
        if (_products[productId].currentCustodian != msg.sender) revert NotCustodian(productId, msg.sender);
        _;
    }

    constructor(address admin) {
        if (admin == address(0)) revert ZeroValue();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

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
    }

    function initiateTransfer(bytes32 productId, address to)
        external
        productMustExist(productId)
        onlyCustodian(productId)
    {
        if (to == address(0)) revert ZeroValue();
        Product storage p = _products[productId];

        if (p.status == Status.Manufactured) {
            _checkRole(MANUFACTURER_ROLE, msg.sender);
            if (!hasRole(DISTRIBUTOR_ROLE, to)) revert InvalidRecipient(productId, to);
        } else if (p.status == Status.AtDistributor) {
            _checkRole(DISTRIBUTOR_ROLE, msg.sender);
            if (!hasRole(RETAILER_ROLE, to)) revert InvalidRecipient(productId, to);
        } else {
            revert InvalidStatus(productId, p.status);
        }

        _statusBeforeTransit[productId] = p.status;
        p.pendingCustodian = to;
        p.status = Status.InTransit;
        p.updatedAt = uint64(block.timestamp);

        emit TransferInitiated(productId, msg.sender, to);
    }

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

    function confirmReceipt(bytes32 productId) external productMustExist(productId) {
        Product storage p = _products[productId];
        if (p.status != Status.InTransit) revert InvalidStatus(productId, p.status);
        if (p.pendingCustodian != msg.sender) revert NotPendingCustodian(productId, msg.sender);

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

    function anchorDocument(bytes32 productId, bytes32 docHash, DocType docType)
        external
        productMustExist(productId)
    {
        if (docHash == bytes32(0)) revert ZeroValue();
        Product storage p = _products[productId];
        bool activeCustodian = p.currentCustodian == msg.sender && hasRole(_custodyRole(productId), msg.sender);
        if (!activeCustodian && !hasRole(CERTIFIER_ROLE, msg.sender)) {
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
    }

    function _custodyRole(bytes32 productId) private view returns (bytes32) {
        Status stage = _products[productId].status;
        if (stage == Status.InTransit) stage = _statusBeforeTransit[productId];
        if (stage == Status.Manufactured) return MANUFACTURER_ROLE;
        if (stage == Status.AtDistributor) return DISTRIBUTOR_ROLE;
        return RETAILER_ROLE;
    }

    function productExists(bytes32 productId) external view returns (bool) {
        return _products[productId].status != Status.None;
    }

    function getProduct(bytes32 productId) external view productMustExist(productId) returns (Product memory) {
        return _products[productId];
    }

    function getBatch(bytes32 batchId) external view returns (Batch memory) {
        if (_batches[batchId].manufacturer == address(0)) revert BatchNotFound(batchId);
        return _batches[batchId];
    }

    function getDocuments(bytes32 productId) external view returns (DocumentRecord[] memory) {
        return _documents[productId];
    }

    function getClaimVerifications(bytes32 productId) external view returns (ClaimVerification[] memory) {
        return _claims[productId];
    }

    function verifyDocument(bytes32 productId, bytes32 docHash) external view returns (bool) {
        return _isAnchored[productId][docHash];
    }
}
