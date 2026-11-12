import hashlib
import json
import os

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi.testclient import TestClient

from app.main import create_app
from app.models import Challenge, SessionToken


class FakeChain:
    identity = "test:deployment"
    config = {"chainId": 31337, "address": "0x" + "12" * 20, "abi": [], "accounts": {}}
    def sync(self, db):
        return None
    def roles(self, address):
        return ["MANUFACTURER_ROLE"]
    def can_attach(self, product_id, address):
        return address.lower() == wallet.address.lower()
    def product(self, product_id):
        return {"productId": product_id, "currentCustodian": wallet.address, "manufacturer": wallet.address, "status": 1}
    def anchored(self, product_id):
        return []


wallet = Account.create()
PAIR = "0x" + "ab" * 32


@pytest.fixture
def client(tmp_path):
    database_url = os.getenv("SPORTCHAIN_TEST_DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    if os.getenv("SPORTCHAIN_TEST_DATABASE_URL"):
        # Opt-in dedicated test database only. Never point this at application data.
        from sqlalchemy import create_engine
        from app.models import Base
        test_engine = create_engine(database_url)
        Base.metadata.drop_all(test_engine)
        test_engine.dispose()
    app = create_app(database_url=database_url, storage=tmp_path / "files", chain=FakeChain())
    with TestClient(app) as c:
        yield c


def login(client):
    challenge = client.post("/api/auth/challenge", json={"address": wallet.address}).json()
    signature = Account.sign_message(encode_defunct(text=challenge["message"]), wallet.key).signature.hex()
    body = {"challengeId": challenge["id"], "signature": signature}
    response = client.post("/api/auth/verify", json=body)
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["token"]}, body


def test_challenge_is_single_use(client):
    _, body = login(client)
    assert client.post("/api/auth/verify", json=body).status_code == 401


def test_private_upload_requires_session_and_remains_private(client):
    assert client.post(f"/api/products/{PAIR}/documents", files={"file": ("a.txt", b"proof")}, data={"docType": "1"}).status_code == 401
    headers, _ = login(client)
    response = client.post(f"/api/products/{PAIR}/documents", headers=headers, files={"file": ("../a.txt", b"proof")}, data={"docType": "1"})
    assert response.status_code == 201
    record = response.json()
    assert record["hash"] == "0x" + hashlib.sha256(b"proof").hexdigest()
    assert record["status"] == "pending"
    assert client.get(f"/api/documents/{record['id']}").status_code == 401
    assert client.get(f"/api/documents/{record['id']}", headers=headers).content == b"proof"
    assert "storage" not in json.dumps(record)


def test_wrong_signature_is_rejected(client):
    challenge = client.post("/api/auth/challenge", json={"address": wallet.address}).json()
    other = Account.create()
    signature = Account.sign_message(encode_defunct(text=challenge["message"]), other.key).signature.hex()
    assert client.post("/api/auth/verify", json={"challengeId": challenge["id"], "signature": signature}).status_code == 401


def test_public_config_and_claim_canonicalization(client):
    assert client.get("/api/config").status_code == 200
    headers, _ = login(client)
    body = {"claim": "recycle\u0301", "evidenceHashes": ["0x" + "CD" * 32, "0x" + "cd" * 32]}
    response = client.post(f"/api/products/{PAIR}/claims", headers=headers, json=body)
    assert response.status_code == 201
    record = response.json()
    expected = json.dumps({"schema": "sportchain.claim.v1", "productId": PAIR, "claim": "recyclé", "evidenceHashes": ["0x" + "cd" * 32]}, ensure_ascii=False, separators=(",", ":"))
    assert record["manifest"] == expected
    assert record["hash"] == "0x" + hashlib.sha256(expected.encode()).hexdigest()


def test_expired_challenge_and_session_are_rejected(client):
    headers, _ = login(client)
    with client.app.state.sessions() as db:
        from sqlalchemy import select
        token = db.scalar(select(SessionToken))
        token.expires = 0
        db.commit()
    assert client.get("/api/me", headers=headers).status_code == 401
    challenge = client.post("/api/auth/challenge", json={"address": wallet.address}).json()
    with client.app.state.sessions() as db:
        db.get(Challenge, challenge["id"]).expires = 0
        db.commit()
    signature = Account.sign_message(encode_defunct(text=challenge["message"]), wallet.key).signature.hex()
    assert client.post("/api/auth/verify", json={"challengeId": challenge["id"], "signature": signature}).status_code == 401


def test_upload_limits_and_invalid_types(client):
    headers, _ = login(client)
    for content, kind, expected in [(b"", "1", 422), (b"x", "9", 422), (b"x" * (10 * 1024 * 1024 + 1), "1", 413)]:
        assert client.post(f"/api/products/{PAIR}/documents", headers=headers, files={"file": ("a.txt", content)}, data={"docType": kind}).status_code == expected


def test_private_file_cannot_be_read_by_another_wallet(client):
    headers, _ = login(client)
    response = client.post(f"/api/products/{PAIR}/documents", headers=headers, files={"file": ("a.txt", b"proof")}, data={"docType": "1"})
    other = Account.create()
    challenge = client.post("/api/auth/challenge", json={"address": other.address}).json()
    signature = Account.sign_message(encode_defunct(text=challenge["message"]), other.key).signature.hex()
    auth = client.post("/api/auth/verify", json={"challengeId": challenge["id"], "signature": signature}).json()
    other_headers = {"Authorization": "Bearer " + auth["token"]}
    assert client.get(f"/api/documents/{response.json()['id']}", headers=other_headers).status_code == 403
    assert client.post(f"/api/products/{PAIR}/documents", headers=other_headers, files={"file": ("a.txt", b"bad")}, data={"docType": "1"}).status_code == 403


def test_chunked_multipart_is_limited_before_parsing(client):
    headers, _ = login(client)
    headers["Content-Type"] = "multipart/form-data; boundary=limit-test"
    def stream():
        yield b'--limit-test\r\nContent-Disposition: form-data; name="padding"\r\n\r\n'
        for _ in range(12):
            yield b"x" * (1024 * 1024)
        yield b"\r\n--limit-test--\r\n"
    assert client.post(f"/api/products/{PAIR}/documents", headers=headers, content=stream()).status_code == 413
