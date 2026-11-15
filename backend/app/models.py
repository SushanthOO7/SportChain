"""Database records. Chain data is a rebuildable index; files are private."""
from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Meta(Base):
    __tablename__ = "metadata"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    block: Mapped[int] = mapped_column(Integer, index=True)
    log_index: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(80))
    product_id: Mapped[str] = mapped_column(String(66), index=True, default="")
    payload: Mapped[str] = mapped_column(Text)
    timestamp: Mapped[int] = mapped_column(Integer)
    transaction: Mapped[str] = mapped_column(String(66))


class Challenge(Base):
    __tablename__ = "challenges"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    address: Mapped[str] = mapped_column(String(42))
    message: Mapped[str] = mapped_column(Text)
    expires: Mapped[int] = mapped_column(Integer)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class SessionToken(Base):
    __tablename__ = "sessions"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    address: Mapped[str] = mapped_column(String(42))
    expires: Mapped[int] = mapped_column(Integer)
    deployment: Mapped[str] = mapped_column(String(200))


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(66), index=True)
    uploader: Mapped[str] = mapped_column(String(42))
    doc_hash: Mapped[str] = mapped_column(String(66))
    doc_type: Mapped[int] = mapped_column(Integer)
    filename: Mapped[str] = mapped_column(String(200))
    size: Mapped[int] = mapped_column(Integer)
    created: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    deployment: Mapped[str] = mapped_column(String(200))


class Manifest(Base):
    __tablename__ = "manifests"
    id: Mapped[str] = mapped_column(String(240), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(66), index=True)
    claim_hash: Mapped[str] = mapped_column(String(66))
    manifest: Mapped[str] = mapped_column(Text)
    deployment: Mapped[str] = mapped_column(String(200))


class CatalogModel(Base):
    __tablename__ = "catalog_models"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)


class Organization(Base):
    __tablename__ = "organizations"
    wallet: Mapped[str] = mapped_column(String(42), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    org_type: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(300), default="")


class RecordLabel(Base):
    __tablename__ = "record_labels"
    id: Mapped[str] = mapped_column(String(300), primary_key=True)
    record_id: Mapped[str] = mapped_column(String(66), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    code: Mapped[str] = mapped_column(String(200))
    deployment: Mapped[str] = mapped_column(String(200))
