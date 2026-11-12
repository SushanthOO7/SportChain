"""Opt-in integration tests: SPORTCHAIN_LIVE_TEST=1 with a seeded local node."""
import json
import os
import secrets

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from web3 import Web3

from app.chain import Chain, ROOT, plain
from app.main import create_app
from app.models import Document, Event

pytestmark = pytest.mark.skipif(os.getenv("SPORTCHAIN_LIVE_TEST") != "1", reason="Requires a seeded local Hardhat node")


@pytest.fixture
def live(tmp_path):
    chain = Chain()
    assert chain.config["chainId"] == 31337, "Never run local integration tests on another chain"
    snapshot = chain.web3.provider.make_request("evm_snapshot", [])["result"]
    database_url = os.getenv("SPORTCHAIN_TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'live.db'}")
    if os.getenv("SPORTCHAIN_TEST_DATABASE_URL"):
        from sqlalchemy import create_engine
        from app.models import Base
        test_engine = create_engine(database_url)
        Base.metadata.drop_all(test_engine)
        test_engine.dispose()
    app = create_app(database_url=database_url, storage=tmp_path / "files", chain=chain)
    with TestClient(app) as client:
        yield client, chain
    chain.web3.provider.make_request("evm_revert", [snapshot])


def authenticate(client, index):
    # Hardhat's public, local-only mnemonic. Never use these accounts on real networks.
    Account.enable_unaudited_hdwallet_features()
    account = Account.from_mnemonic("test test test test test test test test test test test junk", account_path=f"m/44'/60'/0'/0/{index}")
    c = client.post("/api/auth/challenge", json={"address": account.address}).json()
    signature = Account.sign_message(encode_defunct(text=c["message"]), account.key).signature.hex()
    r = client.post("/api/auth/verify", json={"challengeId": c["id"], "signature": signature})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_complete_journey_evidence_and_replay(live):
    client, chain = live
    w3 = chain.web3
    c = chain.contract
    accounts = chain.config["accounts"]
    batch = Web3.keccak(text="integration-batch-" + secrets.token_hex(6))
    pid = "0x" + Web3.keccak(text="integration-pair-" + secrets.token_hex(6)).hex().removeprefix("0x")
    def tx(function, role):
        receipt = w3.eth.wait_for_transaction_receipt(function.transact({"from": accounts[role]}))
        assert receipt.status == 1
    tx(c.functions.registerBatch(batch, 1, bytes(32)), "manufacturer")
    tx(c.functions.registerProduct(pid, batch), "manufacturer")
    headers = authenticate(client, 1)
    upload = client.post(f"/api/products/{pid}/documents", headers=headers, files={"file": ("shipping.txt", b"exact evidence bytes\n")}, data={"docType": "2"})
    assert upload.status_code == 201, upload.text
    doc = upload.json()
    # Failed/cancelled wallet transaction leaves a retrievable pending file.
    assert client.get(f"/api/products/{pid}/uploads", headers=headers).json()[0]["status"] == "pending"
    tx(c.functions.anchorDocument(pid, doc["hash"], 2), "manufacturer")
    assert client.get(f"/api/products/{pid}/uploads", headers=headers).json()[0]["status"] == "confirmed"
    assert c.functions.verifyDocument(pid, Web3.sha3(b"different") if hasattr(Web3, "sha3") else Web3.keccak(b"different")).call() is False
    for sender, recipient in [("manufacturer", "distributor"), ("distributor", "retailer")]:
        tx(c.functions.initiateTransfer(pid, accounts[recipient]), sender)
        tx(c.functions.confirmReceipt(pid), recipient)
    certifier = authenticate(client, 4)
    manifest = client.post(f"/api/products/{pid}/claims", headers=certifier, json={"claim": "Simulated integration claim", "evidenceHashes": [doc["hash"]]})
    assert manifest.status_code == 201, manifest.text
    tx(c.functions.recordClaimVerification(pid, manifest.json()["hash"], True), "certifier")
    tx(c.functions.markSold(pid), "retailer")
    result = client.get(f"/api/products/{pid}")
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["status"] == 5
    assert body["claims"][0]["manifest"]["claim"] == "Simulated integration claim"
    assert len(body["timeline"]) == 8
    with client.app.state.sessions() as db:
        before = db.scalar(select(func.count()).select_from(Event))
        chain.sync(db)
        assert db.scalar(select(func.count()).select_from(Event)) == before
    assert client.get(f"/api/documents/{doc['id']}").status_code == 401


def test_evidence_requires_matching_author_and_chain_rewind_invalidates_confirmation(live):
    client, chain = live
    c = chain.contract
    w3 = chain.web3
    account = chain.config["accounts"]["manufacturer"]
    pid = chain.config["pairs"][0]["productId"]
    headers = authenticate(client, 1)
    doc = client.post(f"/api/products/{pid}/documents", headers=headers, files={"file": ("a.txt", secrets.token_bytes(20))}, data={"docType": "0"}).json()
    # Another authorized signer anchoring identical bytes must not confirm this upload.
    tx = c.functions.anchorDocument(pid, doc["hash"], 0).transact({"from": chain.config["accounts"]["certifier"]})
    w3.eth.wait_for_transaction_receipt(tx)
    assert client.get(f"/api/products/{pid}/uploads", headers=headers).json()[0]["status"] == "pending"
    doc2 = client.post(f"/api/products/{pid}/documents", headers=headers, files={"file": ("b.txt", secrets.token_bytes(20))}, data={"docType": "0"}).json()
    snapshot = w3.provider.make_request("evm_snapshot", [])["result"]
    tx = c.functions.anchorDocument(pid, doc2["hash"], 0).transact({"from": account})
    w3.eth.wait_for_transaction_receipt(tx)
    rows = client.get(f"/api/products/{pid}/uploads", headers=headers).json()
    assert next(d for d in rows if d["id"] == doc2["id"])["status"] == "confirmed"
    w3.provider.make_request("evm_revert", [snapshot])
    rows = client.get(f"/api/products/{pid}/uploads", headers=headers).json()
    assert next(d for d in rows if d["id"] == doc2["id"])["status"] == "pending"


def test_multi_role_custodian_uses_authoritative_transit_permissions(live):
    client, chain = live
    c = chain.contract
    accounts = chain.config["accounts"]
    def tx(function, sender):
        chain.web3.eth.wait_for_transaction_receipt(function.transact({"from": sender}))
    manufacturer = accounts["manufacturer"]
    pid = chain.config["pairs"][0]["productId"]
    tx(c.functions.grantRole(Web3.keccak(text="DISTRIBUTOR_ROLE"), manufacturer), accounts["admin"])
    tx(c.functions.initiateTransfer(pid, manufacturer), manufacturer)
    tx(c.functions.confirmReceipt(pid), manufacturer)
    tx(c.functions.initiateTransfer(pid, accounts["retailer"]), manufacturer)
    tx(c.functions.revokeRole(Web3.keccak(text="MANUFACTURER_ROLE"), manufacturer), accounts["admin"])
    assert chain.can_attach(pid, manufacturer) is True
    headers = authenticate(client, 1)
    response = client.post(f"/api/products/{pid}/documents", headers=headers, files={"file": ("multi-role.txt", b"valid distributor evidence")}, data={"docType": "2"})
    assert response.status_code == 201, response.text


def test_new_deployment_invalidates_sessions_uploads_and_index(live, tmp_path):
    client, chain = live
    config = chain.config
    headers = authenticate(client, 1)
    pid = config["pairs"][0]["productId"]
    uploaded = client.post(f"/api/products/{pid}/documents", headers=headers, files={"file": ("old.txt", b"old deployment evidence")}, data={"docType": "0"}).json()
    assert client.get("/api/products").json()["total"] == 6
    artifact = json.loads((ROOT / "artifacts/contracts/SportChain.sol/SportChain.json").read_text())
    factory = chain.web3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    receipt = chain.web3.eth.wait_for_transaction_receipt(factory.constructor(config["accounts"]["admin"]).transact({"from": config["accounts"]["admin"]}))
    new_config = {**config, "address": receipt.contractAddress, "deploymentBlock": receipt.blockNumber, "deploymentBlockHash": plain(receipt.blockHash)}
    chain.path = tmp_path / "deployment.json"
    chain.path.write_text(json.dumps(new_config))
    assert client.get("/api/me", headers=headers).status_code == 401
    assert client.get("/api/products").json()["total"] == 0
    with client.app.state.sessions() as db:
        assert db.get(Document, uploaded["id"]).status == "stale"
