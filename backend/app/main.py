"""Local SportChain API. Run with uvicorn app.main:app from backend/."""
import hashlib
import json
import logging
import os
import re
import secrets
import time
import unicodedata
from contextlib import asynccontextmanager
from pathlib import Path

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, delete, select, update
from sqlalchemy.orm import Session, sessionmaker
from web3 import Web3

from .chain import Chain, ROOT
from .models import Base, CatalogModel, Challenge, Document, Event, Manifest, Meta, SessionToken
from .middleware import RequestLimits

logger = logging.getLogger("sportchain")
MAX_UPLOAD = 10 * 1024 * 1024
HEX32 = re.compile(r"^0x[0-9a-fA-F]{64}$")
CATALOG = [
    (1, "Relay One", "Everyday running", "#27766c", "A fictional lightweight daily trainer with a breathable mesh upper."),
    (2, "Summit Trail", "Trail running", "#b36b36", "A fictional trail shoe with a reinforced upper and textured outsole."),
    (3, "Court Form", "Court", "#5866a1", "A fictional court silhouette with lateral support and a durable sole."),
    (4, "Tempo Knit", "Road running", "#b84d62", "A fictional road trainer with a flexible knit upper."),
    (5, "Stride Studio", "Training", "#6f6957", "A fictional cross-training shoe with a stable platform."),
    (6, "Distance Zero", "Distance running", "#3e779d", "A fictional cushioned distance trainer. All specifications are simulated."),
]


class AddressBody(BaseModel):
    address: str = Field(min_length=42, max_length=42)


class SignatureBody(BaseModel):
    challengeId: str = Field(max_length=64)
    signature: str = Field(max_length=300)


class ClaimBody(BaseModel):
    claim: str = Field(min_length=1, max_length=2000)
    evidenceHashes: list[str] = Field(default_factory=list, max_length=50)


def identifier(value):
    if HEX32.fullmatch(value):
        return value.lower()
    if not value.strip() or len(value) > 200:
        raise HTTPException(422, "Enter a pair identifier or a serial code of 1–200 characters.")
    return "0x" + Web3.keccak(text=value.strip()).hex().removeprefix("0x")


def document_json(d):
    return {"id": d.id, "productId": d.product_id, "hash": d.doc_hash, "docType": d.doc_type, "filename": d.filename, "size": d.size, "status": d.status, "createdAt": d.created}


def create_app(database_url=None, storage=None, chain=None):
    database_url = database_url or os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'backend/data/sportchain.db'}")
    storage = Path(storage or os.getenv("STORAGE_DIR", str(ROOT / "backend/data/files"))).resolve()
    storage.mkdir(parents=True, exist_ok=True)
    (ROOT / "backend/data").mkdir(exist_ok=True)
    engine = create_engine(database_url, connect_args={"check_same_thread": False} if database_url.startswith("sqlite") else {}, pool_pre_ping=True)
    sessions = sessionmaker(engine, expire_on_commit=False)
    chain = chain or Chain()

    @asynccontextmanager
    async def lifespan(app):
        Base.metadata.create_all(engine)
        with sessions() as db:
            for mid, name, category, color, description in CATALOG:
                db.merge(CatalogModel(id=mid, name=name, category=category, color=color, description=description))
            db.merge(Meta(key="schema_version", value="1"))
            sample_manifest = ROOT / ".runtime/sample-claim.json"
            if sample_manifest.exists():
                # Seed evidence is public simulated content; import its exact bytes.
                try:
                    text = sample_manifest.read_text(encoding="utf-8")
                    manifest = json.loads(text)
                    digest = "0x" + hashlib.sha256(text.encode("utf-8")).hexdigest()
                    db.merge(Manifest(id=f"{chain.identity}:{digest}", product_id=manifest["productId"], claim_hash=digest, manifest=text, deployment=chain.identity))
                except (HTTPException, ValueError, KeyError):
                    logger.warning("Sample claim unavailable; skipping seed manifest import")
            db.commit()
        yield
        engine.dispose()

    app = FastAPI(title="SportChain API", version="1.0.0", lifespan=lifespan)
    app.state.sessions = sessions
    app.state.chain = chain
    origins = os.getenv("APP_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])

    app.add_middleware(RequestLimits, limit=MAX_UPLOAD + 65536)

    @app.exception_handler(Exception)
    async def unavailable(request, exc):
        from fastapi.responses import JSONResponse
        logger.exception("Request failed", exc_info=exc)
        return JSONResponse(status_code=503, content={"detail": "The chain or database is unavailable. Check the local services and deployment configuration."})

    def database():
        with sessions() as db:
            yield db

    def current_user(authorization: str | None = Header(default=None), db: Session = Depends(database)):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Sign in with your wallet to access private evidence.")
        digest = hashlib.sha256(authorization[7:].encode()).hexdigest()
        token = db.get(SessionToken, digest)
        if not token or token.expires <= int(time.time()) or token.deployment != chain.identity:
            raise HTTPException(401, "Your wallet session expired. Sign in again.")
        return token.address

    def require_attach(pid, address):
        if not chain.can_attach(pid, address):
            raise HTTPException(403, "Only an active custodian or certifier may attach evidence for this pair.")

    @app.get("/api/health")
    def health(db: Session = Depends(database)):
        db.execute(select(Meta).limit(1))
        chain.validate() if hasattr(chain, "validate") else None
        return {"status": "ok", "database": "postgresql" if database_url.startswith("postgresql") else "sqlite", "deployment": chain.identity}

    @app.get("/api/config")
    def config():
        # Contains public addresses and ABI only; never private keys.
        return {**chain.config, "maxUploadBytes": MAX_UPLOAD, "simulated": True}

    @app.get("/api/models")
    def models(db: Session = Depends(database)):
        return [{"id": m.id, "name": m.name, "category": m.category, "color": m.color, "description": m.description, "simulated": True} for m in db.scalars(select(CatalogModel).order_by(CatalogModel.id))]

    @app.post("/api/auth/challenge")
    def challenge(body: AddressBody, db: Session = Depends(database)):
        if not Web3.is_address(body.address):
            raise HTTPException(422, "Invalid wallet address.")
        now = int(time.time())
        db.execute(delete(Challenge).where(Challenge.expires < now))
        db.execute(delete(SessionToken).where(SessionToken.expires < now))
        # Bounded database growth per wallet. Issuing a new challenge invalidates old ones.
        db.execute(delete(Challenge).where(Challenge.address == body.address.lower()))
        nonce = secrets.token_hex(24)
        message = f"SportChain local evidence sign-in\nApplication: {os.getenv('AUTH_DOMAIN', 'sportchain.local')}\nWallet: {body.address.lower()}\nDeployment: {chain.identity}\nNonce: {nonce}\nExpires: {now + 300}\nThis signature does not submit a blockchain transaction."
        record = Challenge(id=nonce, address=body.address.lower(), message=message, expires=now + 300, used=False)
        db.add(record)
        db.commit()
        return {"id": nonce, "message": message, "expiresAt": record.expires}

    @app.post("/api/auth/verify")
    def verify(body: SignatureBody, db: Session = Depends(database)):
        record = db.get(Challenge, body.challengeId)
        now = int(time.time())
        if not record or record.used or record.expires <= now or f"Deployment: {chain.identity}\n" not in record.message:
            raise HTTPException(401, "Invalid, expired or already used challenge.")
        try:
            recovered = Account.recover_message(encode_defunct(text=record.message), signature=body.signature)
        except Exception:
            raise HTTPException(401, "Invalid wallet signature.")
        if recovered.lower() != record.address:
            raise HTTPException(401, "The signature does not match this wallet.")
        consumed = db.execute(update(Challenge).where(Challenge.id == record.id, Challenge.used.is_(False), Challenge.expires > now).values(used=True))
        if consumed.rowcount != 1:
            db.rollback()
            raise HTTPException(401, "This challenge has already been used.")
        token = secrets.token_urlsafe(32)
        db.add(SessionToken(digest=hashlib.sha256(token.encode()).hexdigest(), address=record.address, expires=now + 3600, deployment=chain.identity))
        db.commit()
        return {"token": token, "address": record.address, "expiresAt": now + 3600}

    @app.get("/api/me")
    def me(address: str = Depends(current_user)):
        return {"address": address, "roles": chain.roles(address)}

    @app.delete("/api/auth/session", status_code=204)
    def logout(authorization: str = Header(), address: str = Depends(current_user), db: Session = Depends(database)):
        db.execute(delete(SessionToken).where(SessionToken.digest == hashlib.sha256(authorization[7:].encode()).hexdigest()))
        db.commit()

    @app.get("/api/products")
    def products(offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), account: str | None = None, db: Session = Depends(database)):
        if account and not Web3.is_address(account):
            raise HTTPException(422, "Invalid account filter.")
        chain.sync(db)
        ids = list(db.scalars(select(Event.product_id).where(Event.name == "ProductRegistered").order_by(Event.block, Event.log_index)))
        # Local prototype is deliberately small; derive authoritative current state.
        rows = [chain.product(pid) for pid in ids]
        if account:
            rows = [p for p in rows if account.lower() in (p["currentCustodian"].lower(), p["pendingCustodian"].lower())]
        return {"items": rows[offset:offset + limit], "total": len(rows), "offset": offset, "limit": limit}

    @app.get("/api/batches")
    def batches(db: Session = Depends(database)):
        chain.sync(db)
        return [json.loads(e.payload) for e in db.scalars(select(Event).where(Event.name == "BatchRegistered").order_by(Event.block))]

    @app.get("/api/products/{code}")
    def product(code: str, db: Session = Depends(database)):
        pid = identifier(code)
        chain.sync(db)
        p = chain.product(pid)
        history = [{"event": e.name, "args": json.loads(e.payload), "timestamp": e.timestamp, "transactionHash": e.transaction, "block": e.block} for e in db.scalars(select(Event).where(Event.product_id == pid).order_by(Event.block, Event.log_index))]
        claims = chain.claims(pid) if hasattr(chain, "claims") else []
        for claim in claims:
            manifest = db.get(Manifest, f"{chain.identity}:{claim['hash']}")
            claim["manifest"] = json.loads(manifest.manifest) if manifest else None
        return {**p, "timeline": history, "documents": chain.anchored(pid), "claims": claims, "simulated": True}

    @app.get("/api/products/{code}/uploads")
    def uploads(code: str, address: str = Depends(current_user), db: Session = Depends(database)):
        pid = identifier(code)
        chain.sync(db)
        return [document_json(d) for d in db.scalars(select(Document).where(Document.product_id == pid, Document.uploader == address, Document.deployment == chain.identity).order_by(Document.created.desc()))]

    @app.post("/api/products/{code}/documents", status_code=201)
    def upload(code: str, file: UploadFile = File(), docType: int = Form(ge=0, le=5), address: str = Depends(current_user), db: Session = Depends(database)):
        pid = identifier(code)
        require_attach(pid, address)
        doc_id = secrets.token_hex(24)
        target = storage / doc_id
        size = 0
        digest = hashlib.sha256()
        try:
            with target.open("xb") as destination:
                while chunk := file.file.read(65536):
                    size += len(chunk)
                    if size > MAX_UPLOAD:
                        raise HTTPException(413, "File exceeds the 10 MiB upload limit.")
                    digest.update(chunk)
                    destination.write(chunk)
            if size == 0:
                raise HTTPException(422, "Choose a non-empty file.")
            filename = re.sub(r"[^\w. ()-]", "_", (file.filename or "document").replace("\\", "/").split("/")[-1])[:150] or "document"
            record = Document(id=doc_id, product_id=pid, uploader=address, doc_hash="0x" + digest.hexdigest(), doc_type=docType, filename=filename, size=size, created=int(time.time()), status="pending", deployment=chain.identity)
            db.add(record)
            db.commit()
            return document_json(record)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        finally:
            file.file.close()

    @app.get("/api/documents/{doc_id}")
    def download(doc_id: str, address: str = Depends(current_user), db: Session = Depends(database)):
        record = db.get(Document, doc_id)
        if not record or record.deployment != chain.identity:
            raise HTTPException(404, "Document not found in this deployment.")
        # Explicit private-file policy: only the original uploader may download.
        if record.uploader != address:
            raise HTTPException(403, "Only the original uploader can download this private document.")
        if not (storage / record.id).exists():
            raise HTTPException(410, "The stored file is no longer available.")
        return FileResponse(storage / record.id, filename=record.filename, media_type="application/octet-stream", headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"})

    @app.post("/api/products/{code}/claims", status_code=201)
    def manifest(code: str, body: ClaimBody, address: str = Depends(current_user), db: Session = Depends(database)):
        pid = identifier(code)
        chain.product(pid)
        if "CERTIFIER_ROLE" not in chain.roles(address) and "MANUFACTURER_ROLE" not in chain.roles(address):
            raise HTTPException(403, "Only a certifier or manufacturer may prepare a claim manifest.")
        if not body.claim.strip() or any(not HEX32.fullmatch(h) for h in body.evidenceHashes):
            raise HTTPException(422, "Provide claim text and valid SHA-256 evidence hashes.")
        text = json.dumps({"schema": "sportchain.claim.v1", "productId": pid, "claim": unicodedata.normalize("NFC", body.claim), "evidenceHashes": sorted(set(h.lower() for h in body.evidenceHashes))}, ensure_ascii=False, separators=(",", ":"))
        digest = "0x" + hashlib.sha256(text.encode("utf-8")).hexdigest()
        db.merge(Manifest(id=f"{chain.identity}:{digest}", product_id=pid, claim_hash=digest, manifest=text, deployment=chain.identity))
        db.commit()
        return {"hash": digest, "manifest": text}

    @app.post("/api/maintenance/cleanup")
    def cleanup(address: str = Depends(current_user), db: Session = Depends(database)):
        chain.sync(db)
        records = list(db.scalars(select(Document).where(Document.uploader == address, Document.status.in_(["pending", "stale"]), Document.created < int(time.time()) - 86400)))
        for record in records:
            (storage / record.id).unlink(missing_ok=True)
            db.delete(record)
        db.commit()
        return {"removed": len(records)}

    return app


app = create_app()
