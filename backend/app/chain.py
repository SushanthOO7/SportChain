"""Deployment-bound RPC reads and idempotent event synchronization."""
import json
import os
import secrets
import threading
from pathlib import Path

from fastapi import HTTPException
from hexbytes import HexBytes
from sqlalchemy import delete, select
from web3 import Web3
from web3.exceptions import ContractLogicError

from .models import Document, Event, Meta

ROOT = Path(__file__).resolve().parents[2]
ROLES = ["DEFAULT_ADMIN_ROLE", "MANUFACTURER_ROLE", "DISTRIBUTOR_ROLE", "RETAILER_ROLE", "CERTIFIER_ROLE"]
PRODUCT_FIELDS = ["batchId", "manufacturer", "currentCustodian", "pendingCustodian", "status", "registeredAt", "updatedAt"]


def plain(value):
    if isinstance(value, (bytes, HexBytes)):
        return "0x" + bytes(value).hex()
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [plain(v) for v in value]
    return value


class Chain:
    def __init__(self):
        self.path = Path(os.getenv("DEPLOYMENT_FILE", str(ROOT / ".runtime/deployment.json")))
        self.web3 = Web3(Web3.HTTPProvider(os.getenv("RPC_URL", "http://127.0.0.1:8545"), request_kwargs={"timeout": 8}))
        self.lock = threading.RLock()
        self._config = None

    @property
    def config(self):
        if not self.path.exists():
            raise HTTPException(503, "No deployment configured. Start the local chain and run npm run seed.")
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if self._config != data:
            self._config = data
            self.contract = self.web3.eth.contract(address=Web3.to_checksum_address(data["address"]), abi=data["abi"])
        return data

    @property
    def identity(self):
        c = self.config
        return f"{c['chainId']}:{c['address'].lower()}:{c['deploymentBlockHash']}"

    def validate(self):
        c = self.config
        if self.web3.eth.chain_id != c["chainId"]:
            raise HTTPException(503, "RPC chain ID differs from the configured deployment.")
        block = self.web3.eth.get_block(c["deploymentBlock"])
        if plain(block["hash"]) != c["deploymentBlockHash"] or not self.web3.eth.get_code(c["address"]):
            raise HTTPException(503, "The local chain was reset. Run npm run seed and refresh.")

    def roles(self, address):
        self.validate()
        account = Web3.to_checksum_address(address)
        return [r for r in ROLES if self.contract.functions.hasRole(bytes(32) if r == ROLES[0] else Web3.keccak(text=r), account).call()]

    def product(self, product_id):
        self.validate()
        if not self.contract.functions.productExists(product_id).call():
            raise HTTPException(404, "Pair not found. Check the identifier or serial code.")
        result = dict(zip(PRODUCT_FIELDS, plain(self.contract.functions.getProduct(product_id).call())))
        batch = self.contract.functions.getBatch(result["batchId"]).call()
        result.update(productId=product_id, modelId=batch[0], batchDocumentHash=plain(batch[3]))
        return result

    def can_attach(self, product_id, address):
        self.product(product_id)
        # eth_call simulates the contract's exact permission logic without writing
        # state or spending gas, including multi-role custodians and transit origin.
        try:
            self.contract.functions.anchorDocument(product_id, secrets.token_bytes(32), 0).call({"from": Web3.to_checksum_address(address)})
            return True
        except ContractLogicError:
            return False

    def anchored(self, product_id):
        self.validate()
        return [dict(zip(["hash", "docType", "submittedBy", "submittedAt"], plain(row))) for row in self.contract.functions.getDocuments(product_id).call()]

    def claims(self, product_id):
        self.validate()
        return [dict(zip(["hash", "passed", "certifier", "verifiedAt"], plain(row))) for row in self.contract.functions.getClaimVerifications(product_id).call()]

    def sync(self, db):
        with self.lock:
            self.validate()
            identity = self.identity
            state = db.get(Meta, "deployment")
            checkpoint = db.get(Meta, "checkpoint")
            checkpoint_hash = db.get(Meta, "checkpoint_hash")
            head = self.web3.eth.block_number
            reset = state is None or state.value != identity
            if checkpoint and not reset:
                old_head = int(checkpoint.value)
                reset = old_head > head or checkpoint_hash is None or plain(self.web3.eth.get_block(old_head)["hash"]) != checkpoint_hash.value
            if reset:
                db.execute(delete(Event))
                for document in db.scalars(select(Document)):
                    document.status = "pending" if document.deployment == identity else "stale"
                db.merge(Meta(key="deployment", value=identity))
                start = self.config["deploymentBlock"]
            else:
                start = int(checkpoint.value) + 1 if checkpoint else self.config["deploymentBlock"]
            event_abis = [a for a in self.config["abi"] if a.get("type") == "event" and a["name"] not in ("RoleAdminChanged", "RoleGranted", "RoleRevoked")]
            topics = {Web3.keccak(text=f"{a['name']}({','.join(i['type'] for i in a['inputs'])})").hex(): a["name"] for a in event_abis}
            timestamps = {}
            for lower in range(start, head + 1, 1000):
                logs = self.web3.eth.get_logs({"address": self.config["address"], "fromBlock": lower, "toBlock": min(lower + 999, head)})
                for log in logs:
                    name = topics.get(log["topics"][0].hex())
                    if not name:
                        continue
                    decoded = getattr(self.contract.events, name)().process_log(log)
                    args = plain(dict(decoded["args"]))
                    block = log["blockNumber"]
                    if block not in timestamps:
                        timestamps[block] = self.web3.eth.get_block(block)["timestamp"]
                    tx = plain(log["transactionHash"])
                    db.merge(Event(id=f"{tx}:{log['logIndex']}", block=block, log_index=log["logIndex"], name=name, product_id=args.get("productId", "").lower(), payload=json.dumps(args), timestamp=timestamps[block], transaction=tx))
            db.flush()
            for document in db.scalars(select(Document).where(Document.deployment == identity, Document.status.in_(["pending", "confirmed"]))):
                matches = db.scalars(select(Event).where(Event.name == "DocumentAnchored", Event.product_id == document.product_id))
                document.status = "confirmed" if any((a := json.loads(e.payload))["docHash"].lower() == document.doc_hash and a["submittedBy"].lower() == document.uploader and a["docType"] == document.doc_type for e in matches) else "pending"
            db.merge(Meta(key="checkpoint", value=str(head)))
            db.merge(Meta(key="checkpoint_hash", value=plain(self.web3.eth.get_block(head)["hash"])))
            db.commit()
