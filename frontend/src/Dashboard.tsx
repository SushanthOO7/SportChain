import { useEffect, useState, type FormEvent } from "react";
import { id, isAddress, ZeroHash } from "ethers";
import { Link } from "react-router-dom";
import { api } from "./api";
import { useApp } from "./context";
import { PairTable } from "./components";
import { same, short, type Pair } from "./types";
import { EvidencePanel } from "./evidence";

const ROLE_NAMES: Record<string, string> = {
  manufacturer: "MANUFACTURER_ROLE",
  distributor: "DISTRIBUTOR_ROLE",
  retailer: "RETAILER_ROLE",
  certifier: "CERTIFIER_ROLE",
  admin: "DEFAULT_ADMIN_ROLE",
};
const titles: Record<string, string> = {
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  retailer: "Retailer",
  certifier: "Certifier",
  admin: "Administration",
};
const descriptions: Record<string, string> = {
  manufacturer:
    "Give each pair its first recorded identity and begin its journey.",
  distributor: "Acknowledge incoming pairs and coordinate the next handoff.",
  retailer: "Confirm store arrival and attest customer handover.",
  certifier: "Record attributable checks against precise product claims.",
  admin: "Manage the organizations allowed to write to the shared ledger.",
};
function pairId(code: string) {
  const value = code.trim();
  if (!value) throw new Error("Enter a pair or batch identifier.");
  return /^0x[\da-f]{64}$/i.test(value) ? value : id(value);
}

export function Dashboard({ role }: { role: string }) {
  const { account, roles, config, models, revision, busy, transact, perform } =
    useApp();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState("");
  const [model, setModel] = useState("1");
  const [serial, setSerial] = useState("");
  const [recipient, setRecipient] = useState("");
  const [evidencePair, setEvidencePair] = useState("");
  const [claim, setClaim] = useState("");
  const [evidenceHashes, setEvidenceHashes] = useState("");
  const [passed, setPassed] = useState("true");
  const [prepared, setPrepared] = useState<{
    hash: string;
    manifest: string;
  }>();
  const [target, setTarget] = useState("");
  const [grantRole, setGrantRole] = useState("MANUFACTURER_ROLE");
  const [permissionAction, setPermissionAction] = useState("grantRole");
  const [review, setReview] = useState<null | {
    name: string;
    args: unknown[];
    description: string;
  }>(null);
  const authorized = roles.includes(ROLE_NAMES[role]);
  useEffect(() => {
    setReview(null);
    setPrepared(undefined);
    setError("");
    setOffset(0);
  }, [role, account]);
  useEffect(() => {
    if (!account) {
      setPairs([]);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    api<{ items: Pair[]; total: number }>(
      `/products?limit=25&offset=${offset}&account=${account}`,
      {
        signal: abort.signal,
      },
    )
      .then((data) => {
        setPairs(data.items);
        setTotal(data.total);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [account, revision, offset]);
  async function registerBatch(e: FormEvent) {
    e.preventDefault();
    if (!batch.trim()) {
      setError("Enter a batch code.");
      return;
    }
    setError("");
    await transact("registerBatch", [pairId(batch), Number(model), ZeroHash]);
  }
  async function registerPair(e: FormEvent) {
    e.preventDefault();
    if (!batch.trim() || !serial.trim()) {
      setError("Enter both the batch code and pair serial.");
      return;
    }
    setError("");
    await transact("registerProduct", [pairId(serial), pairId(batch)]);
  }
  async function prepare(e: FormEvent) {
    e.preventDefault();
    setPrepared(undefined);
    await perform(async () => {
      if (!serial.trim() || !claim.trim())
        throw new Error("Enter a pair and the exact claim text.");
      const token = await appSignIn();
      const result = await api<{ hash: string; manifest: string }>(
        `/products/${pairId(serial)}/claims`,
        {
          method: "POST",
          body: JSON.stringify({
            claim,
            evidenceHashes: evidenceHashes.split(/[\s,]+/).filter(Boolean),
          }),
        },
        token,
      );
      setPrepared(result);
    }, "Claim manifest prepared. Review it before recording your attestation.");
  }
  const { signIn: appSignIn } = useApp();
  return (
    <>
      <section className="intro compact">
        <div>
          <p className="eyebrow">STAKEHOLDER WORKSPACE</p>
          <h1>{titles[role]}</h1>
          <p className="intro-copy">{descriptions[role]}</p>
        </div>
      </section>
      <div className={`notice ${authorized ? "" : "warning"}`}>
        {account
          ? authorized
            ? `Active ${role} wallet · ${short(account)}`
            : `This wallet does not hold ${ROLE_NAMES[role]}. Connect an authorized account to use these actions.`
          : "Connect your authorized wallet to make changes. Public lookup remains available without a wallet."}
        {config?.accounts?.[role] && (
          <small className="break">
            Demo account: <code>{config.accounts[role]}</code>
          </small>
        )}
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {role === "manufacturer" && (
        <div className="bottom-grid">
          <section className="panel padded">
            <p className="eyebrow">REGISTRATION / BATCH</p>
            <h2>Create a production batch</h2>
            <form noValidate className="form-stack" onSubmit={registerBatch}>
              <label htmlFor="batch-code">Batch code</label>
              <input
                id="batch-code"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                maxLength={200}
                placeholder="SC-BATCH-007"
              />
              <label htmlFor="model">Footwear model</label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {models.map((m) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <small>
                Batch document hash is optional and omitted here. Attach later
                evidence to individual pairs.
              </small>
              <button disabled={busy || !authorized} className="button">
                Register batch
              </button>
            </form>
          </section>
          <section className="panel padded">
            <p className="eyebrow">REGISTRATION / PAIR</p>
            <h2>Register a pair</h2>
            <form noValidate className="form-stack" onSubmit={registerPair}>
              <label htmlFor="pair-batch">Existing batch code or ID</label>
              <input
                id="pair-batch"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                maxLength={200}
              />
              <label htmlFor="pair-serial">Unique pair serial</label>
              <input
                id="pair-serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                maxLength={200}
                placeholder="SC-PAIR-0007"
              />
              <small>
                The serial is hashed into its on-chain ID. It must be unique.
              </small>
              <button disabled={busy || !authorized} className="button">
                Register pair
              </button>
            </form>
          </section>
        </div>
      )}
      {["manufacturer", "distributor"].includes(role) && (
        <section className="panel padded">
          <h2>Shipment recipient</h2>
          <p className="muted">
            Set the authorized{" "}
            {role === "manufacturer" ? "distributor" : "retailer"} address used
            by the “Start transfer” actions below.
          </p>
          <label htmlFor="recipient">Recipient wallet address</label>
          <input
            id="recipient"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={
              config?.accounts?.[
                role === "manufacturer" ? "distributor" : "retailer"
              ] || "0x…"
            }
          />
          <button
            className="text-button"
            onClick={() =>
              setRecipient(
                config?.accounts?.[
                  role === "manufacturer" ? "distributor" : "retailer"
                ] || "",
              )
            }
          >
            Use demo recipient
          </button>
        </section>
      )}
      {["manufacturer", "distributor", "retailer"].includes(role) && (
        <section className="panel">
          <div className="section-heading">
            <h2>Your custody and incoming pairs</h2>
          </div>
          {loading ? (
            <p className="loading">Reading custody…</p>
          ) : (
            <PairTable pairs={pairs} />
          )}
          <div className="action-list">
            {pairs.map((p) => (
              <div className="pair-actions" key={p.productId}>
                <Link className="mono" to={`/lookup/${p.productId}`}>
                  {config?.pairs?.find((x) => x.productId === p.productId)
                    ?.serial || short(p.productId)}
                </Link>
                <div className="button-row">
                  {p.status === 2 && same(p.pendingCustodian, account) && (
                    <button
                      disabled={busy || !authorized}
                      className="button small"
                      onClick={() => transact("confirmReceipt", [p.productId])}
                    >
                      Confirm receipt
                    </button>
                  )}
                  {p.status === 2 && same(p.currentCustodian, account) && (
                    <button
                      disabled={busy}
                      className="button small outline"
                      onClick={() => transact("cancelTransfer", [p.productId])}
                    >
                      Cancel transfer
                    </button>
                  )}
                  {[1, 3].includes(p.status) &&
                    same(p.currentCustodian, account) && (
                      <button
                        disabled={busy || !authorized}
                        className="button small"
                        onClick={() => {
                          if (!isAddress(recipient)) {
                            setError(
                              "Enter a valid recipient wallet address above.",
                            );
                            document.getElementById("recipient")?.focus();
                            return;
                          }
                          transact("initiateTransfer", [
                            p.productId,
                            recipient,
                          ]);
                        }}
                      >
                        Start transfer
                      </button>
                    )}
                  {p.status === 4 &&
                    same(p.currentCustodian, account) &&
                    role === "retailer" && (
                      <button
                        disabled={busy || !authorized}
                        className="button small"
                        onClick={() =>
                          setReview({
                            name: "markSold",
                            args: [p.productId],
                            description: `Record sale and customer handover for ${short(p.productId)}? This ends custody transfers and cannot be undone.`,
                          })
                        }
                      >
                        Record sale & handover
                      </button>
                    )}
                  <button
                    className="button small outline"
                    onClick={() => setEvidencePair(p.productId)}
                  >
                    Attach evidence
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="panel-footer">
            <span>{total} matching pairs</span>
            <div className="button-row">
              <button
                className="button small outline"
                disabled={!offset || loading || busy}
                onClick={() => setOffset((n) => Math.max(0, n - 25))}
              >
                Previous
              </button>
              <button
                className="button small outline"
                disabled={offset + 25 >= total || loading || busy}
                onClick={() => setOffset((n) => n + 25)}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
      {role === "certifier" && (
        <section className="panel padded">
          <h2>Prepare a claim check</h2>
          <p className="muted">
            Describe a precise claim and reference its evidence hashes.
            Preparing the manifest does not attest that the claim passed.
          </p>
          <form noValidate className="form-stack" onSubmit={prepare}>
            <label htmlFor="claim-pair">Pair ID or serial</label>
            <input
              id="claim-pair"
              value={serial}
              onChange={(e) => {
                setSerial(e.target.value);
                setPrepared(undefined);
              }}
              maxLength={200}
            />
            <label htmlFor="claim-text">Exact claim</label>
            <textarea
              className="resize-none"
              id="claim-text"
              value={claim}
              onChange={(e) => {
                setClaim(e.target.value);
                setPrepared(undefined);
              }}
              maxLength={2000}
              rows={3}
            />
            <label htmlFor="evidence-hashes">
              Evidence SHA-256 hashes (separated by commas or spaces)
            </label>
            <textarea
              className="resize-none"
              id="evidence-hashes"
              value={evidenceHashes}
              onChange={(e) => {
                setEvidenceHashes(e.target.value);
                setPrepared(undefined);
              }}
              rows={2}
            />
            <button className="button" disabled={busy || !authorized}>
              Prepare manifest
            </button>
          </form>
          {prepared && (
            <div className="review">
              <h3>Review the exact manifest</h3>
              <pre>{prepared.manifest}</pre>
              <code className="break">SHA-256: {prepared.hash}</code>
              <label htmlFor="claim-result">Verification result</label>
              <select
                id="claim-result"
                value={passed}
                onChange={(e) => setPassed(e.target.value)}
              >
                <option value="true">Passed — claim confirmed</option>
                <option value="false">Not confirmed</option>
              </select>
              <button
                className="button"
                disabled={busy || !authorized}
                onClick={() =>
                  transact("recordClaimVerification", [
                    pairId(serial),
                    prepared.hash,
                    passed === "true",
                  ])
                }
              >
                Record attestation
              </button>
            </div>
          )}
        </section>
      )}
      {role === "admin" && (
        <section className="panel padded">
          <h2>Organization permissions</h2>
          <p className="muted">
            Role changes take effect on-chain. Revocation preserves historical
            custody and evidence.
          </p>
          <form
            noValidate
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!isAddress(target)) {
                setError("Enter a valid wallet address.");
                return;
              }
              setReview({
                name: permissionAction,
                args: [
                  grantRole === "DEFAULT_ADMIN_ROLE" ? ZeroHash : id(grantRole),
                  target,
                ],
                description: `${permissionAction === "grantRole" ? "Grant" : "Revoke"} ${grantRole} for ${target}? ${grantRole === "DEFAULT_ADMIN_ROLE" ? "This role controls all organization permissions. Avoid removing the last administrator." : "This changes the wallet’s ability to submit authorized actions."}`,
              });
            }}
          >
            <label htmlFor="permission-address">Organization wallet</label>
            <input
              id="permission-address"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
            <label htmlFor="permission-role">Role</label>
            <select
              id="permission-role"
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value)}
            >
              {Object.values(ROLE_NAMES).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <label htmlFor="permission-action">Action</label>
            <select
              id="permission-action"
              value={permissionAction}
              onChange={(e) => setPermissionAction(e.target.value)}
            >
              <option value="grantRole">Grant role</option>
              <option value="revokeRole">Revoke role</option>
            </select>
            <button disabled={busy || !authorized} className="button">
              Review permission change
            </button>
          </form>
        </section>
      )}
      {review && (
        <section className="panel padded review" aria-labelledby="review-title">
          <h2 id="review-title">Review before signing</h2>
          <p>{review.description}</p>
          <div className="button-row">
            <button className="button outline" onClick={() => setReview(null)}>
              Cancel
            </button>
            <button
              disabled={busy || !authorized}
              className="button"
              onClick={async () => {
                if (await transact(review.name, review.args)) setReview(null);
              }}
            >
              Confirm and sign
            </button>
          </div>
        </section>
      )}
      {role === "certifier" && (
        <section className="panel padded">
          <h2>Attach certification evidence</h2>
          <label htmlFor="cert-evidence-pair">
            Pair for certification evidence
          </label>
          <input
            id="cert-evidence-pair"
            value={evidencePair}
            onChange={(e) => setEvidencePair(e.target.value)}
            maxLength={200}
          />
        </section>
      )}
      {evidencePair.trim() && (
        <EvidencePanel
          key={`${evidencePair}-${account}`}
          productId={pairId(evidencePair)}
        />
      )}
    </>
  );
}
