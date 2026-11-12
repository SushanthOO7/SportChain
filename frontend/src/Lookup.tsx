import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { sha256 } from "ethers";
import { ArrowLeft, Download, FileCheck, ShieldCheck } from "lucide-react";
import { api } from "./api";
import { useApp } from "./context";
import { Badge, CustodyTrack, SearchBox, Shoe } from "./components";
import { docTypes, short, type Detail } from "./types";
import { EvidencePanel } from "./evidence";

export function Lookup() {
  const { code = "" } = useParams();
  const { revision, models, config, busy, perform } = useApp();
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState("");
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setDetail(undefined);
    setResult("");
    setError("");
    api<Detail>(`/products/${encodeURIComponent(code)}`, {
      signal: abort.signal,
    })
      .then(setDetail)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [code, revision]);
  useEffect(() => {
    let active = true;
    if (detail)
      QRCode.toDataURL(`${window.location.origin}/lookup/${detail.productId}`, {
        margin: 2,
        width: 200,
        color: { dark: "#152c31", light: "#ffffff" },
      }).then((data) => {
        if (active) setQr(data);
      });
    return () => {
      active = false;
    };
  }, [detail?.productId]);
  const model = models.find((m) => m.id === detail?.modelId);
  const serial = config?.pairs?.find(
    (p) => p.productId === detail?.productId,
  )?.serial;
  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!file || !detail) return;
    await perform(async () => {
      const hash = sha256(new Uint8Array(await file.arrayBuffer()));
      setResult(
        detail.documents.some((d) => d.hash === hash)
          ? "Match found: this file’s exact bytes match a document hash anchored for this pair."
          : "No match: this file differs from the anchored documents, or was never anchored for this pair.",
      );
    }, "File comparison complete.");
  }
  if (loading)
    return (
      <section className="panel loading" role="status">
        Loading the pair’s recorded journey…
      </section>
    );
  if (error || !detail)
    return (
      <section className="panel explainer">
        <h1>Pair unavailable</h1>
        <p role="alert">{error}</p>
        <SearchBox />
      </section>
    );
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} /> Pair inventory
      </Link>
      <div className="section-heading">
        <div>
          <p className="eyebrow">PUBLIC PROVENANCE RECORD</p>
          <h1>{model?.name || `Model ${detail.modelId}`}</h1>
          <p className="muted">
            {serial || "Registered pair"} · {model?.category}
          </p>
        </div>
        <Badge status={detail.status} />
      </div>
      <section className="pair-overview panel">
        <div
          className="product-art"
          style={{ backgroundColor: `${model?.color || "#27766c"}12` }}
        >
          <Shoe color={model?.color} />
          <small>Fictional model · Original illustration</small>
        </div>
        <div className="product-information">
          <p>{model?.description}</p>
          <dl>
            <dt>Pair identifier</dt>
            <dd className="mono break">{detail.productId}</dd>
            <dt>Current custodian</dt>
            <dd className="mono break">{detail.currentCustodian}</dd>
            {detail.status === 2 && (
              <>
                <dt>Pending recipient</dt>
                <dd className="mono break">{detail.pendingCustodian}</dd>
              </>
            )}
            <dt>Batch</dt>
            <dd className="mono break">{detail.batchId}</dd>
          </dl>
        </div>
        <div className="qr-card">
          {qr && (
            <>
              <img
                width="148"
                height="148"
                src={qr}
                alt={`QR link to this pair’s public record`}
              />
              <a
                className="inline-link"
                href={qr}
                download={`${serial || "sportchain-pair"}.png`}
              >
                <Download size={15} /> Download QR
              </a>
            </>
          )}
          <small>
            Opens this local application.
            <br />
            Phone access requires reachable hosting.
          </small>
        </div>
      </section>
      <section className="panel track-panel">
        <CustodyTrack status={detail.status} />
        {detail.status === 2 && (
          <p className="muted">
            In transit: the sender retains custody until the named recipient
            confirms receipt.
          </p>
        )}
        {detail.status === 5 && (
          <p className="muted">
            Sale and customer handover are retailer-attested. No buyer identity
            or buyer confirmation is recorded.
          </p>
        )}
      </section>
      <div className="detail-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Recorded journey</h2>
            <span className="muted">{detail.timeline.length} events</span>
          </div>
          <ol className="timeline">
            {detail.timeline.map((event, i) => (
              <li key={`${event.transactionHash}-${i}`}>
                <span className="timeline-marker" />
                <div>
                  <strong>
                    {event.event.replace(/([a-z])([A-Z])/g, "$1 $2")}
                  </strong>
                  <small>
                    {new Date(event.timestamp * 1000).toLocaleString()} · Block{" "}
                    {event.block}
                  </small>
                  <code title={event.transactionHash}>
                    Transaction {short(event.transactionHash)}
                  </code>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="stack">
          <section className="panel padded">
            <h2>
              <FileCheck size={21} /> Document integrity
            </h2>
            <p className="muted">
              Compare a file locally. Its contents are not uploaded.
            </p>
            <form noValidate onSubmit={verify} className="form-stack">
              <label htmlFor="verify-file">File to compare</label>
              <input
                id="verify-file"
                type="file"
                onChange={(e) => {
                  setFile(e.target.files?.[0]);
                  setResult("");
                }}
              />
              <button className="button" disabled={busy || !file}>
                {busy ? "Checking…" : "Compare file hash"}
              </button>
            </form>
            {result && (
              <p className="notice" role="status">
                {result}
              </p>
            )}
            <ul className="evidence-list">
              {detail.documents.map((d) => (
                <li key={d.hash}>
                  <strong>{docTypes[d.docType]}</strong>
                  <code className="break">{d.hash}</code>
                  <small>Submitted by {short(d.submittedBy)}</small>
                </li>
              ))}
            </ul>
            {!detail.documents.length && (
              <p className="muted">No documents anchored yet.</p>
            )}
          </section>
          <section className="panel padded">
            <h2>
              <ShieldCheck size={21} /> Certifier attestations
            </h2>
            {!detail.claims.length ? (
              <p className="muted">
                No claim checks recorded. Certification is optional.
              </p>
            ) : (
              detail.claims.map((claim, i) => (
                <article className="claim" key={`${claim.hash}-${i}`}>
                  <span
                    className={`badge ${claim.passed ? "status-5" : "status-2"}`}
                  >
                    {claim.passed ? "Passed" : "Not confirmed"}
                  </span>
                  <p>
                    {claim.manifest?.claim ||
                      "Claim manifest not available in this evidence store."}
                  </p>
                  <code className="break">{claim.hash}</code>
                  <small>
                    Certifier {short(claim.certifier)} ·{" "}
                    {new Date(claim.verifiedAt * 1000).toLocaleString()}
                  </small>
                </article>
              ))
            )}
            <small>
              Each result is a certifier’s statement. Rechecks and conflicting
              results remain visible.
            </small>
          </section>
        </div>
      </div>
      <EvidencePanel productId={detail.productId} />
    </>
  );
}
