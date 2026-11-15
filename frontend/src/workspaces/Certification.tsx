import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import {
  FlaskConical,
  FileText,
  Plus,
  ArrowRight,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context";
import { useRegistry } from "../registry";
import { type Detail, short } from "../types";
import {
  EmptyState,
  Hash,
  Hero,
  Panel,
  ShoeImage,
  Status,
} from "../reference-ui";
import { EvidencePanel } from "../evidence";
export function Certification() {
  const app = useApp();
  const location = useLocation();
  const { organization, label } = useRegistry();
  const lookupRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [pair, setPair] = useState<Detail>();
  const [error, setError] = useState("");
  const [claim, setClaim] = useState("");
  const [claimType, setClaimType] = useState("Authenticity (Genuine Product)");
  const [hashes, setHashes] = useState("");
  const [manifest, setManifest] = useState<{
    hash: string;
    manifest: string;
    productId: string;
  }>();
  const [result, setResult] = useState("");
  const [showEvidence, setShowEvidence] = useState(false);
  const authorized = app.roles.includes("CERTIFIER_ROLE");
  useEffect(() => {
    setPair(undefined);
    setManifest(undefined);
    setResult("");
    setError("");
    setLoading(false);
    setShowEvidence(false);
    if (!code) return;
    setLoading(true);
    const abort = new AbortController();
    api<Detail>(`/products/${encodeURIComponent(code)}`, {
      signal: abort.signal,
    })
      .then(setPair)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [code, app.revision]);
  async function prepare() {
    if (!pair || !claim.trim()) return;
    const pid = pair.productId;
    await app.perform(async () => {
      const token = await app.signIn();
      const value = await api<{ hash: string; manifest: string }>(
        `/products/${pid}/claims`,
        {
          method: "POST",
          body: JSON.stringify({
            claim: claim.trim(),
            evidenceHashes: hashes.split(/[\s,]+/).filter(Boolean),
          }),
        },
        token,
      );
      setManifest({ ...value, productId: pid });
      setResult("");
    }, "Claim manifest prepared. Review the exact claim before attesting.");
  }
  return (
    <>
      <Hero
        small
        scene={
          <div className="certifier-scene">
            <img
              className="certifier-scene-background"
              src="/images/certifier-court-background-v1.webp"
              alt=""
              width="1774"
              height="887"
            />
            <span className="certifier-shoe-shadow" />
            <img
              className="certifier-scene-shoe"
              src="/images/certifier-court-shoe-v1.webp"
              alt=""
              width="1536"
              height="1024"
              fetchPriority="high"
            />
          </div>
        }
        eyebrow={`CERTIFIER${organization(app.account) ? ` — ${organization(app.account)?.name}` : ""}`}
        title="Evaluate and Attest Authenticity"
        description="Verify product claims, validate evidence, and write attestations on-chain."
      />
      <section className="certifier-board">
        <div className="certifier-columns">
          <Panel
            title={
              <>
                <span className="step-number">1</span>Pair Lookup
              </>
            }
          >
            <form
              className="compact-search"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!app.busy && query.trim()) setCode(query.trim());
              }}
            >
              <Search size={16} />
              <label className="sr-only" htmlFor="claim-pair">
                Pair ID or serial
              </label>
              <Input
                ref={lookupRef}
                disabled={app.busy}
                id="claim-pair"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter pair serial or ID"
              />
              {query && (
                <Button
                  className="icon-button"
                  type="button"
                  disabled={app.busy}
                  aria-label="Clear pair lookup"
                  onClick={() => {
                    setQuery("");
                    setCode("");
                    lookupRef.current?.focus();
                  }}
                >
                  <X size={14} />
                </Button>
              )}
              <Button
                type="submit"
                className="icon-button"
                disabled={app.busy || loading || !query.trim()}
                aria-label="Look up pair"
              >
                <ArrowRight size={17} />
              </Button>
            </form>
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {loading ? (
              <div className="empty-state" role="status">
                <strong>Looking up pair…</strong>
                <p>Loading its registered details.</p>
              </div>
            ) : pair ? (
              <div className="certifier-pair">
                <ShoeImage />
                <strong>{label(pair)}</strong>
                <small>Batch: {pair.batchCode || short(pair.batchId)}</small>
                <Status status={pair.status} />
                <dl className="pair-facts">
                  <dt>Current custodian</dt>
                  <dd>
                    {organization(pair.currentCustodian)?.name ||
                      short(pair.currentCustodian)}
                  </dd>
                  <dt>Model</dt>
                  <dd>
                    {app.models.find((m) => m.id === pair.modelId)?.name ||
                      `Model ${pair.modelId}`}
                  </dd>
                  <dt>Registered on</dt>
                  <dd>
                    {new Date(pair.registeredAt * 1000).toLocaleDateString()}
                  </dd>
                </dl>
              </div>
            ) : (
              <EmptyState title="Find a registered pair">
                Enter its serial or blockchain ID to start.
              </EmptyState>
            )}
          </Panel>
          <Panel
            title={
              <>
                <span className="step-number">2</span>Exact Claim
              </>
            }
          >
            <label htmlFor="claim-type">Claim Type</label>
            <select
              id="claim-type"
              value={claimType}
              onChange={(e) => {
                setClaimType(e.target.value);
                setManifest(undefined);
                setResult("");
              }}
              disabled={app.busy}
            >
              <option>Authenticity (Genuine Product)</option>
              <option>Quality & Compliance</option>
              <option>Material / Origin</option>
              <option>Other</option>
            </select>
            <label htmlFor="claim-text">Claim Statement</label>
            <textarea
              className="resize-none"
              id="claim-text"
              value={claim}
              onChange={(e) => {
                setClaim(e.target.value);
                setManifest(undefined);
                setResult("");
              }}
              maxLength={2000}
              rows={5}
              placeholder="Describe the exact claim being evaluated…"
              disabled={app.busy}
            />
            <small className="character-count">{claim.length} / 2000</small>
            <p className="form-help">
              Your attestation applies to this exact statement and its
              referenced evidence.
            </p>
          </Panel>
          <Panel
            title={
              <>
                <span className="step-number">3</span>Supporting Evidence
                (Hashes)
              </>
            }
          >
            {pair?.documents.map((d, i) => (
              <div className="certifier-document" key={`${d.hash}-${i}`}>
                <FileText size={20} />
                <div>
                  <strong>Anchored document {i + 1}</strong>
                  <Hash value={d.hash} label="Copy evidence hash" />
                </div>
                <Button
                  className="icon-button"
                  disabled={app.busy}
                  aria-label={`Include evidence ${i + 1}`}
                  onClick={() => {
                    setHashes((v) =>
                      [
                        ...new Set([
                          ...v.split(/[\s,]+/).filter(Boolean),
                          d.hash,
                        ]),
                      ].join("\n"),
                    );
                    setManifest(undefined);
                    setResult("");
                  }}
                >
                  <Plus size={16} />
                </Button>
              </div>
            ))}
            <label htmlFor="evidence-hashes">Evidence SHA-256 hashes</label>
            <textarea
              className="resize-none"
              id="evidence-hashes"
              value={hashes}
              onChange={(e) => {
                setHashes(e.target.value);
                setManifest(undefined);
                setResult("");
              }}
              placeholder="Paste hashes separated by commas or spaces"
              rows={4}
              disabled={app.busy}
            />
            <Button
              className="button soft full-width"
              disabled={!pair || !authorized || app.busy}
              aria-expanded={showEvidence}
              aria-controls="private-evidence"
              onClick={() => setShowEvidence((v) => !v)}
            >
              <Plus size={16} />
              {showEvidence ? "Hide Evidence" : "Add Evidence"}
            </Button>
            <p className="form-help">
              {!pair
                ? "Look up a pair to attach supporting documents."
                : !authorized
                  ? "A certifier wallet is required to attach evidence."
                  : "Include document hashes to support your exact claim."}
            </p>
          </Panel>
          <Panel
            title={
              <>
                <span className="step-number">4</span>Generated Claim Manifest
              </>
            }
          >
            {manifest ? (
              <>
                <div className="manifest-title">
                  <FileText size={19} />
                  <strong>CLAIM MANIFEST</strong>
                </div>
                <dl className="pair-facts">
                  <dt>Pair ID</dt>
                  <dd>
                    <Hash value={manifest.productId} />
                  </dd>
                  <dt>Evidence Count</dt>
                  <dd>{JSON.parse(manifest.manifest).evidenceHashes.length}</dd>
                  <dt>Manifest SHA-256</dt>
                  <dd>
                    <Hash value={manifest.hash} />
                  </dd>
                </dl>
                <details>
                  <summary>Review exact manifest</summary>
                  <pre>{manifest.manifest}</pre>
                </details>
              </>
            ) : (
              <EmptyState title="No manifest generated">
                Define the claim and evidence, then prepare its exact bytes.
              </EmptyState>
            )}
            <p className="form-help" id="manifest-help">
              {!authorized
                ? "Connect a wallet with the certifier role to prepare a manifest."
                : !pair
                  ? "Look up a registered pair first."
                  : !claim.trim()
                    ? "Enter a claim statement to prepare its manifest."
                    : "Prepare the manifest, then review its contents below."}
            </p>
            <Button
              aria-describedby="manifest-help"
              className="button outline full-width"
              onClick={prepare}
              disabled={app.busy || !authorized || !pair || !claim.trim()}
            >
              Prepare manifest <ArrowRight size={16} />
            </Button>
          </Panel>
          <Panel
            title={
              <>
                <span className="step-number">5</span>Verification Result
              </>
            }
          >
            <label htmlFor="claim-result">Certifier's assessment</label>
            <select
              id="claim-result"
              value={result}
              disabled={!manifest || app.busy}
              onChange={(e) => setResult(e.target.value)}
            >
              <option value="">Choose a result</option>
              <option value="true">Passed — claim confirmed</option>
              <option value="false">Not confirmed</option>
            </select>
            {result ? (
              <div
                className={`verification-result ${result === "true" ? "passed" : "not-confirmed"}`}
              >
                <ShieldCheck size={28} />
                <div>
                  <strong>
                    {result === "true" ? "Passed" : "Not Confirmed"}
                  </strong>
                  <p>Selected by the certifier. Ready for wallet signing.</p>
                </div>
              </div>
            ) : (
              <div className="verification-pending">
                <FlaskConical size={30} />
                <p>
                  {manifest
                    ? "Review the claim and select your assessment."
                    : "Prepare a claim manifest to unlock your assessment."}
                </p>
              </div>
            )}
            <Button
              className="button full-width"
              disabled={app.busy || !authorized || !manifest || !result}
              onClick={() => {
                if (manifest)
                  void app.transact("recordClaimVerification", [
                    manifest.productId,
                    manifest.hash,
                    result === "true",
                  ]);
              }}
            >
              Attest on Blockchain <ArrowRight size={18} />
            </Button>
          </Panel>
        </div>
        <div className="certifier-progress">
          {[
            "Lookup Pair",
            "Enter Claim",
            "Add Evidence",
            "Generate Manifest",
            "Verify (SHA-256)",
            "Attest on Chain",
          ].map((step, i) => (
            <div key={step}>
              <span
                className={
                  (i === 0 && pair) ||
                  (i === 1 && claim) ||
                  (i === 2 && hashes) ||
                  (i === 3 && manifest) ||
                  (i === 4 && result)
                    ? "complete"
                    : ""
                }
              >
                {i + 1}
              </span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>
      {["#history", "#reports", "#attestations"].includes(location.hash) && (
        <Panel title="Recorded attestations">
          {pair?.claims.length ? (
            pair.claims.map((claim, i) => (
              <div className="history-row" key={i}>
                <strong>{claim.passed ? "Passed" : "Not confirmed"}</strong>
                <Hash value={claim.hash} label="Copy claim hash" />
              </div>
            ))
          ) : (
            <EmptyState title="No attestations loaded">
              Look up a pair to view its recorded claims.
            </EmptyState>
          )}
        </Panel>
      )}
      {showEvidence && pair && (
        <EvidencePanel
          productId={pair.productId}
          key={`${pair.productId}-${app.account}`}
        />
      )}
    </>
  );
}
