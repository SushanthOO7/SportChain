import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { sha256 } from "ethers";
import {
  ArrowLeft,
  Package,
  Factory,
  Truck,
  ShieldCheck,
  FileText,
  FlaskConical,
  Download,
  Check,
  UserRound,
  Calendar,
  Search,
} from "lucide-react";
import { api } from "./api";
import { useApp } from "./context";
import { useRegistry } from "./registry";
import { type Detail, docTypes, short, statuses } from "./types";
import {
  CopyButton,
  EmptyState,
  Hash,
  LookupSearch,
  Panel,
} from "./reference-ui";
import { EvidencePanel } from "./evidence";
import { Skeleton } from "./ui";
export function Lookup() {
  const { code } = useParams();
  const app = useApp();
  const { organization, label } = useRegistry();
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qr, setQr] = useState("");
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<
    { match: boolean; hash: string } | undefined
  >();
  const [checking, setChecking] = useState(false);
  const verificationEpoch = useRef(0);
  useEffect(() => {
    verificationEpoch.current++;
    setChecking(false);
    setDetail(undefined);
    setError("");
    setResult(undefined);
    setFile(undefined);
    setQr("");
    if (!code) {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
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
  }, [code, app.revision]);
  useEffect(() => {
    let active = true;
    if (detail)
      QRCode.toDataURL(`${location.origin}/lookup/${detail.productId}`, {
        width: 200,
        margin: 1,
        color: { dark: "#151515", light: "#ffffff" },
      }).then((q) => {
        if (active) setQr(q);
      });
    return () => {
      active = false;
    };
  }, [detail?.productId]);
  const model = app.models.find((m) => m.id === detail?.modelId);
  const serial = detail ? label(detail) : "";
  const current = detail ? organization(detail.currentCustodian) : undefined;
  const pending = detail ? organization(detail.pendingCustodian) : undefined;
  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!file || !detail) return;
    const epoch = ++verificationEpoch.current;
    setChecking(true);
    try {
      const hash = sha256(new Uint8Array(await file.arrayBuffer()));
      if (epoch !== verificationEpoch.current) return;
      setResult({
        hash,
        match: detail.documents.some(
          (d) => d.hash.toLowerCase() === hash.toLowerCase(),
        ),
      });
    } catch {
      if (epoch === verificationEpoch.current)
        setError("Unable to read this file. Select it again and retry.");
    } finally {
      if (epoch === verificationEpoch.current) setChecking(false);
    }
  }
  function eventDescription(event: Detail["timeline"][number]) {
    const address = (value: unknown) =>
      organization(String(value || ""))?.name || short(String(value || ""));
    return event.event === "TransferInitiated"
      ? `${address(event.args.from)} → ${address(event.args.to)}. Custody remains with the sender until receipt.`
      : event.event === "ReceiptConfirmed"
        ? `Receipt confirmed by ${address(event.args.to)}.`
        : event.event === "TransferCancelled"
          ? `Transfer cancelled. Custody remains with ${address(event.args.from)}.`
          : event.event === "ProductRegistered"
            ? `Registered by ${address(event.args.manufacturer)}.`
            : event.event === "ProductSold"
              ? "Sale and customer handover recorded by the retailer."
              : event.event === "DocumentAnchored"
                ? `Document hash anchored by ${address(event.args.submittedBy)}.`
                : event.event === "ClaimVerified"
                  ? `Certifier assessment: ${event.args.passed ? "Passed" : "Not confirmed"}.`
                  : "Recorded on the blockchain.";
  }
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Back to Overview
      </Link>
      <section className="passport-top">
        <div className="passport-art" aria-hidden="true">
          <img
            className="passport-scene-background"
            src="/images/passport-garden-background-v3.webp"
            alt=""
            width="1774"
            height="887"
          />
          <img
            className="passport-scene-shoe"
            src="/images/passport-garden-shoe-v3.webp"
            alt=""
            width="1774"
            height="887"
          />
        </div>
        <div className="passport-intro">
          <div className="passport-copy">
            <h1>Pair Passport</h1>
            <p>
              A verifiable, tamper-evident history of a unique footwear pair
              <br className="desktop-break" /> from manufacturing to final sale.
            </p>
            {detail ? (
              <>
                <div className="passport-identity">
                  <Factory size={25} />
                  <div>
                    <strong>
                      {organization(detail.manufacturer)?.name ||
                        "Manufacturer"}
                    </strong>
                    <small>{short(detail.manufacturer)}</small>
                  </div>
                  <span />
                  <Package size={22} />
                  <strong>{serial}</strong>
                </div>
                <h2>{model?.name || `Model ${detail.modelId}`}</h2>
                <p className="batch-subtitle">
                  <strong>Batch:</strong>{" "}
                  {detail.batchCode || short(detail.batchId)}
                </p>
                {model?.category && (
                  <span className="status">{model.category}</span>
                )}
              </>
            ) : (
              <div className="passport-lookup">
                <LookupSearch />
                {error && (
                  <p className="notice error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="passport-summary">
          <Panel>
            <div className="passport-qr">
              {qr ? (
                <img
                  width="100"
                  height="100"
                  src={qr}
                  alt="QR link to this pair’s public record"
                />
              ) : (
                <div className="empty-qr">
                  <Search size={42} strokeWidth={1.2} />
                </div>
              )}
              <div>
                <strong>{serial || "Look up a registered pair"}</strong>
                {detail ? (
                  <span className="status status-4">
                    <Check size={13} />
                    Record on Chain
                  </span>
                ) : (
                  <small>Enter a serial number or blockchain ID.</small>
                )}
                {qr && (
                  <a
                    href={qr}
                    download={`${serial || "sportchain-pair"}.png`}
                    className="button button-compact"
                  >
                    <Download size={13} />
                    Download QR
                  </a>
                )}
              </div>
            </div>
          </Panel>
          <Panel title="Custody Information">
            <div className="custody-information-row">
              <Factory size={26} />
              <div>
                <small>Current Custodian</small>
                <strong>
                  {current?.name ||
                    (detail ? short(detail.currentCustodian) : "—")}
                </strong>
              </div>
              {detail && (
                <span className="status">
                  {detail.status === 5 ? "Handover Complete" : "Custody Active"}
                </span>
              )}
            </div>
            <div className="custody-information-row">
              <Truck size={26} />
              <div>
                <small>Pending Custodian</small>
                <strong>
                  {detail?.status === 2
                    ? pending?.name || short(detail.pendingCustodian)
                    : "—"}
                </strong>
              </div>
              {detail?.status === 2 && (
                <span className="status">Awaiting Receipt</span>
              )}
            </div>
          </Panel>
        </div>
      </section>
      <Panel className="passport-status-bar">
        <div className="large-custody-status">
          <div>
            <strong>Custody Status</strong>
            <span>{detail ? statuses[detail.status] : "No Pair Selected"}</span>
          </div>
        </div>
      </Panel>
      {loading ? (
        <Skeleton label="Loading the pair’s recorded journey…" />
      ) : !detail ? (
        <div className="passport-empty-grid">
          <Panel title="Pair Details">
            <EmptyState title={error ? "Pair unavailable" : "No pair selected"}>
              Look up a registered serial to view its passport.
            </EmptyState>
          </Panel>
          <Panel title="Blockchain Event Timeline">
            <EmptyState title="No events loaded">
              Only actual recorded blockchain events appear here.
            </EmptyState>
          </Panel>
          <Panel title="Anchored Documents">
            <EmptyState title="No documents loaded">
              Document hashes appear after evidence is anchored.
            </EmptyState>
          </Panel>
        </div>
      ) : (
        <div className="passport-grid">
          <div>
            <Panel title="Pair Details">
              <dl className="passport-facts">
                <dt>
                  <Package size={17} />
                  Pair ID
                </dt>
                <dd>
                  {serial}
                  <CopyButton value={detail.productId} />
                </dd>
                <dt>
                  <Package size={17} />
                  Batch ID
                </dt>
                <dd>
                  {detail.batchCode || short(detail.batchId)}
                  <CopyButton value={detail.batchId} />
                </dd>
                <dt>
                  <FileText size={17} />
                  Model
                </dt>
                <dd>{model?.name || `Model ${detail.modelId}`}</dd>
                <dt>
                  <Calendar size={17} />
                  Registered On
                </dt>
                <dd>{new Date(detail.registeredAt * 1000).toLocaleString()}</dd>
                <dt>
                  <Factory size={17} />
                  Manufacturer
                </dt>
                <dd>
                  {organization(detail.manufacturer)?.name ||
                    short(detail.manufacturer)}
                </dd>
              </dl>
            </Panel>
            <Panel
              title={
                <>
                  Evidence{" "}
                  <span className="heading-note">(On-Chain Hashes)</span>
                </>
              }
            >
              <div className="evidence-tiles">
                {detail.documents.map((document, i) => (
                  <div key={`${document.hash}-${i}`}>
                    <FileText size={30} />
                    <strong>{docTypes[document.docType]}</strong>
                    <Hash value={document.hash} label="Copy evidence hash" />
                  </div>
                ))}
              </div>
              {!detail.documents.length && (
                <EmptyState title="No evidence anchored" />
              )}
            </Panel>
          </div>
          <Panel title="Blockchain Event Timeline" id="journey">
            <ol className="timeline">
              {detail.timeline.map((event, i) => {
                const EventIcon =
                  event.event === "ProductRegistered"
                    ? Factory
                    : event.event === "ClaimVerified"
                      ? FlaskConical
                      : event.event === "ProductSold"
                        ? UserRound
                        : event.event === "DocumentAnchored"
                          ? FileText
                          : Truck;
                return (
                  <li key={`${event.transactionHash}-${i}`}>
                    <span className="timeline-marker" />
                    <span className="timeline-icon">
                      <EventIcon size={21} />
                    </span>
                    <div>
                      <strong>
                        {event.event.replace(/([a-z])([A-Z])/g, "$1 $2")}
                      </strong>
                      <p>{eventDescription(event)}</p>
                      <small>
                        {new Date(event.timestamp * 1000).toLocaleString()}
                      </small>
                      <details className="transaction-details">
                        <summary>Transaction details</summary>
                        <p>
                          Block {event.block} · Chain {app.config?.chainId}
                        </p>
                        <div className="full-hash">
                          <code>{event.transactionHash}</code>
                          <CopyButton
                            value={event.transactionHash}
                            label="Copy transaction hash"
                          />
                        </div>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
          <div>
            <Panel
              title={
                <>
                  Anchored Documents{" "}
                  <span className="heading-note">(On-Chain References)</span>
                </>
              }
            >
              <div className="anchored-documents">
                {detail.documents.map((document, i) => (
                  <div className="document-row" key={`${document.hash}-${i}`}>
                    <FileText size={20} />
                    <strong>{docTypes[document.docType]}</strong>
                    <Hash value={document.hash} label="Copy document hash" />
                  </div>
                ))}
              </div>
              {!detail.documents.length && (
                <EmptyState title="No documents anchored" />
              )}
            </Panel>
            <Panel
              title="Locally Calculated SHA-256 Verification"
              id="integrity"
            >
              <form noValidate onSubmit={verify} className="verification-form">
                <label htmlFor="verify-file">File to compare</label>
                <Input
                  id="verify-file"
                  type="file"
                  onChange={(e) => {
                    verificationEpoch.current++;
                    setChecking(false);
                    setFile(e.target.files?.[0]);
                    setResult(undefined);
                  }}
                />
                <Button className="button outline" disabled={!file || checking}>
                  {checking ? "Checking…" : "Compare file hash"}
                </Button>
              </form>
              {result && (
                <div
                  className={`hash-verification ${result.match ? "passed" : "not-confirmed"}`}
                  role="status"
                >
                  <ShieldCheck size={24} />
                  <div>
                    <strong>{result.match ? "Hash Match" : "No Match"}</strong>
                    <p>
                      {result.match
                        ? "This file’s exact bytes match an anchored document hash."
                        : "This file differs from the anchored documents, or was never anchored for this pair."}
                    </p>
                    <Hash value={result.hash} />
                  </div>
                </div>
              )}
              <p className="form-help">
                File comparison stays in your browser. A hash match establishes
                file integrity, not physical authenticity.
              </p>
            </Panel>
            <Panel title={`Certifier Attestations (${detail.claims.length})`}>
              <div className="attestations-list">
                {detail.claims.map((claim, i) => (
                  <article key={`${claim.hash}-${i}`}>
                    <FlaskConical size={25} />
                    <div>
                      <strong>
                        {organization(claim.certifier)?.name ||
                          short(claim.certifier)}
                      </strong>
                      <p>
                        {claim.manifest?.claim ||
                          "Manifest unavailable in this evidence store."}
                      </p>
                      <span
                        className={`status ${claim.passed ? "status-4" : "status-2"}`}
                      >
                        {claim.passed ? "Passed" : "Not Confirmed"}
                      </span>
                      <small>
                        {new Date(claim.verifiedAt * 1000).toLocaleDateString()}
                      </small>
                      <Hash value={claim.hash} />
                    </div>
                  </article>
                ))}
              </div>
              {!detail.claims.length && (
                <EmptyState title="No attestations recorded" />
              )}
              <p className="form-help">
                Each result is a certifier’s statement. Rechecks and conflicting
                assessments remain visible.
              </p>
            </Panel>
          </div>
        </div>
      )}
      {detail && (
        <EvidencePanel
          productId={detail.productId}
          key={`${detail.productId}-${app.account}`}
        />
      )}
    </>
  );
}
