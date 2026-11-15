import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Package,
  Truck,
  Layers,
  ShoppingBag,
  ShieldCheck,
  ArrowRight,
  Search,
  Check,
  Info,
  FileText,
} from "lucide-react";
import { isAddress } from "ethers";
import { useApp } from "../context";
import { useRegistry } from "../registry";
import { same, short, type Pair } from "../types";
import { api } from "../api";
import {
  CustodyFlow,
  EmptyState,
  Hash,
  Hero,
  Metrics,
  Panel,
  ShoeImage,
  Status,
} from "../reference-ui";
import { EvidencePanel } from "../evidence";
import { useFormValidation } from "../form-validation";
import type { Detail } from "../types";
export function Distribution({ retailer = false }: { retailer?: boolean }) {
  const app = useApp();
  const registry = useRegistry();
  const { pairs, label, organization, organizations, loading } = registry;
  const authorized = app.roles.includes(
    retailer ? "RETAILER_ROLE" : "DISTRIBUTOR_ROLE",
  );
  const ownOrg = organization(app.account);
  const incoming = pairs.filter(
    (p) => p.status === 2 && same(p.pendingCustodian, app.account),
  );
  const custody = pairs.filter(
    (p) =>
      same(p.currentCustodian, app.account) && p.status !== (retailer ? 5 : 2),
  );
  const outgoing = pairs.filter(
    (p) => p.status === 2 && same(p.currentCustodian, app.account),
  );
  const sold = pairs.filter(
    (p) => p.status === 5 && same(p.currentCustodian, app.account),
  );
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tab, setTab] = useState("Evidence & Documents");
  const [detail, setDetail] = useState<Detail>();
  const [detailError, setDetailError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [evidence, setEvidence] = useState("");
  const validation = useFormValidation();
  const location = useLocation();
  const available = custody.filter((p) => p.status !== (retailer ? 5 : 2));
  const selected =
    pairs.find((p) => p.productId === selectedId) ||
    available[0] ||
    incoming[0] ||
    outgoing[0];
  const canSell =
    !!selected &&
    authorized &&
    selected.status === 4 &&
    same(selected.currentCustodian, app.account);
  const saleHelp = !app.account
    ? "Connect your retailer wallet to record a sale."
    : !authorized
      ? "A wallet with the retailer role is required to record a sale."
      : !selected
        ? "Select a pair from inventory before reviewing the handover."
        : !canSell
          ? "Confirm receipt and take custody of this pair before recording its sale."
          : "Review the pair and confirm the customer handover before signing.";
  const model = app.models.find((m) => m.id === selected?.modelId);
  useEffect(() => {
    setConfirmed(false);
    setDetail(undefined);
    setDetailError("");
    if (!selected) return;
    const abort = new AbortController();
    api<Detail>(`/products/${selected.productId}`, { signal: abort.signal })
      .then(setDetail)
      .catch((e) => {
        if (!abort.signal.aborted) setDetailError(e.message);
      });
    return () => abort.abort();
  }, [selected?.productId, app.revision]);
  useEffect(() => {
    const section = location.hash.slice(1);
    document
      .getElementById(
        section === "sale"
          ? "next-action"
          : section === "incoming"
            ? "incoming"
            : section === "evidence"
              ? "selected-pair"
              : section === "transfers"
                ? "outgoing"
                : section,
      )
      ?.scrollIntoView({ block: "start" });
  }, [location.hash]);
  function choose(p: Pair) {
    setSelectedId(p.productId);
    setEvidence("");
  }
  const filtered = available.filter((p) =>
    `${label(p)} ${p.batchCode || p.batchId} ${app.models.find((m) => m.id === p.modelId)?.name || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  async function transfer() {
    if (
      !selected ||
      !validation.validate({
        recipient: isAddress(recipient)
          ? ""
          : "Enter an authorized retailer wallet.",
      })
    )
      return;
    await app.transact("initiateTransfer", [selected.productId, recipient]);
  }
  const inventory = (
    <Panel
      title={
        <>
          Inventory{" "}
          <span className="heading-note">
            ({available.length.toLocaleString()})
          </span>
        </>
      }
      id="inventory"
    >
      <div className="inventory-search">
        <Search size={17} />
        <label htmlFor="inventory-query" className="sr-only">
          Search inventory
        </label>
        <Input
          id="inventory-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by Pair Serial, Batch, or Model…"
        />
        {query && (
          <Button
            className="icon-button"
            aria-label="Clear inventory search"
            onClick={(event) => {
              setQuery("");
              event.currentTarget.parentElement
                ?.querySelector("input")
                ?.focus();
            }}
          >
            ×
          </Button>
        )}
      </div>
      <div className="inventory-list">
        {filtered.map((p) => (
          <Button
            className={`inventory-item ${selected?.productId === p.productId ? "selected" : ""}`}
            key={p.productId}
            onClick={() => choose(p)}
          >
            <ShoeImage />
            <span>
              <strong>{label(p)}</strong>
              <small>
                {app.models.find((m) => m.id === p.modelId)?.name ||
                  `Model ${p.modelId}`}
              </small>
              <small>Batch: {p.batchCode || short(p.batchId)}</small>
            </span>
            <span className="inventory-status">
              <Status status={p.status} />
              <small>
                Received {new Date(p.updatedAt * 1000).toLocaleDateString()}
              </small>
            </span>
          </Button>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState title={query ? "No matching pairs" : "No inventory yet"}>
          {query
            ? "Try a different serial, batch, or model."
            : app.account
              ? "Confirm an incoming receipt to take custody."
              : "Connect your wallet to see your inventory."}
        </EmptyState>
      )}
    </Panel>
  );
  const receipts = (
    <Panel
      title={
        <>
          Incoming Transfers{" "}
          <span className="count-bubble">{incoming.length}</span>
        </>
      }
      id="incoming"
    >
      <p className="panel-description">
        Pairs sent to you. Confirm receipt to take custody.
      </p>
      <div className="transfer-list">
        {incoming.map((p) => (
          <article
            className={`incoming-item ${selected?.productId === p.productId ? "selected" : ""}`}
            key={p.productId}
          >
            <Button className="transfer-identity" onClick={() => choose(p)}>
              <ShoeImage />
              <span>
                <strong>{label(p)}</strong>
                <small>Batch: {p.batchCode || short(p.batchId)}</small>
              </span>
              <Status status={2} />
            </Button>
            <div className="transfer-sender">
              <Package size={15} />
              <span>
                From:{" "}
                {organization(p.currentCustodian)?.name ||
                  short(p.currentCustodian)}
              </span>
            </div>
            <div className="receipt-actions">
              <small>
                Sent {new Date(p.updatedAt * 1000).toLocaleString()}
              </small>
              <Button
                className="button small"
                disabled={app.busy || !authorized}
                onClick={() => app.transact("confirmReceipt", [p.productId])}
              >
                Confirm receipt <ArrowRight size={15} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!incoming.length && (
        <EmptyState title="No incoming transfers">
          New shipments will appear here when sent to your wallet.
        </EmptyState>
      )}
    </Panel>
  );
  const outgoingPanel = (
    <Panel
      title={
        <>
          Outgoing Transfers{" "}
          <span className="count-bubble">{outgoing.length}</span>
        </>
      }
      id="outgoing"
    >
      <p className="panel-description">
        Sent pairs remain in your custody until receipt.
      </p>
      {outgoing.map((p) => (
        <div className="outgoing-item" key={p.productId}>
          <ShoeImage />
          <div>
            <Link to={`/lookup/${p.productId}`}>
              <strong>{label(p)}</strong>
            </Link>
            <small>
              →{" "}
              {organization(p.pendingCustodian)?.name ||
                short(p.pendingCustodian)}
            </small>
            <Status status={2} />
          </div>
          <Button
            className="button small outline"
            disabled={app.busy}
            onClick={() => app.transact("cancelTransfer", [p.productId])}
          >
            Cancel transfer
          </Button>
        </div>
      ))}
      {!outgoing.length && (
        <EmptyState title="No outgoing transfers">
          Your pending retailer shipments will appear here.
        </EmptyState>
      )}
    </Panel>
  );
  const passport = (
    <Panel
      id="selected-pair"
      title="Pair Passport"
      className={`selected-passport ${selected ? "has-selection" : "is-empty"}`}
    >
      {selected ? (
        <>
          <div className="selected-product">
            <div className="selected-product-image">
              <ShoeImage />
            </div>
            <div>
              <h2>{label(selected)}</h2>
              <dl className="pair-facts">
                <dt>Model</dt>
                <dd>{model?.name || `Model ${selected.modelId}`}</dd>
                <dt>Batch</dt>
                <dd>{selected.batchCode || short(selected.batchId)}</dd>
                <dt>Status</dt>
                <dd>
                  <Status status={selected.status} />
                </dd>
                <dt>Custodian</dt>
                <dd>
                  {organization(selected.currentCustodian)?.name ||
                    short(selected.currentCustodian)}
                </dd>
              </dl>
            </div>
          </div>
          {retailer && (
            <div className="passport-provenance">
              <div>
                <h3>
                  Provenance{" "}
                  <span className="heading-note">(Custody Chain)</span>
                </h3>
                <Link
                  to={`/lookup/${selected.productId}`}
                  className="button button-compact"
                >
                  View Full History <ArrowRight size={14} />
                </Link>
              </div>
              <CustodyFlow pair={selected} compact />
            </div>
          )}
          <div
            className="detail-tabs"
            role="tablist"
            aria-label="Pair information"
          >
            {["Evidence & Documents", "Transfer History", "Details"].map(
              (name) => (
                <Button
                  key={name}
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                >
                  {name}
                </Button>
              ),
            )}
          </div>
          <div className="detail-tab-content" role="tabpanel">
            {detailError ? (
              <p className="notice error">{detailError}</p>
            ) : tab === "Evidence & Documents" ? (
              <>
                {detail?.documents.length ? (
                  detail.documents.map((d, i) => (
                    <div className="document-row" key={`${d.hash}-${i}`}>
                      <FileText size={21} />
                      <div>
                        <strong>Anchored document</strong>
                        <small>SHA-256</small>
                      </div>
                      <Hash value={d.hash} label="Copy document hash" />
                    </div>
                  ))
                ) : (
                  <EmptyState title="No anchored documents">
                    Attach supporting evidence and anchor its SHA-256 hash.
                  </EmptyState>
                )}
                <Button
                  className="button button-compact"
                  onClick={() => setEvidence(selected.productId)}
                >
                  <PlusIcon />
                  Add Evidence
                </Button>
              </>
            ) : tab === "Transfer History" ? (
              <>
                {detail?.timeline
                  .filter((e) =>
                    [
                      "TransferInitiated",
                      "TransferCancelled",
                      "ReceiptConfirmed",
                      "ProductSold",
                    ].includes(e.event),
                  )
                  .map((e, i) => (
                    <div className="history-row" key={i}>
                      <Check size={16} />
                      <strong>
                        {e.event.replace(/([a-z])([A-Z])/g, "$1 $2")}
                      </strong>
                      <small>
                        {new Date(e.timestamp * 1000).toLocaleString()}
                      </small>
                    </div>
                  ))}
                {!detail?.timeline.length && (
                  <EmptyState title="No history loaded" />
                )}
              </>
            ) : (
              <dl className="pair-facts">
                <dt>Pair ID</dt>
                <dd>
                  <Hash value={selected.productId} />
                </dd>
                <dt>Registered</dt>
                <dd>
                  {new Date(selected.registeredAt * 1000).toLocaleString()}
                </dd>
                <dt>Manufacturer</dt>
                <dd>
                  {organization(selected.manufacturer)?.name ||
                    short(selected.manufacturer)}
                </dd>
              </dl>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="empty-passport-image">
            <img
              className="shoe-image manufacturer-batch-shoe"
              src="/images/manufacturer-batch-shoe.avif"
              alt="White Nike S.T. Dynamite shoe with black swoosh and outsole"
            />
          </div>
          <EmptyState title="Select a pair">
            Its identity, custody chain, and evidence will appear here.
          </EmptyState>
        </>
      )}
    </Panel>
  );
  const nextAction = (
    <Panel
      title={retailer ? "Record Sale & Handover" : "Next Action"}
      id="next-action"
      className="next-action"
    >
      {retailer ? (
        <ol className="retailer-sale-steps" aria-label="Sale progress">
          <li aria-current={!canSell ? "step" : undefined}>
            <span>1</span>Review pair
          </li>
          <li aria-current={canSell && !confirmed ? "step" : undefined}>
            <span>2</span>Confirm handover
          </li>
          <li aria-current={canSell && confirmed ? "step" : undefined}>
            <span>3</span>Sign
          </li>
        </ol>
      ) : (
        <ol
          className="distributor-transfer-steps"
          aria-label="Transfer progress"
        >
          <li aria-current={!selected ? "step" : undefined}>
            <span>1</span>Choose pair
          </li>
          <li aria-current={selected && !recipient ? "step" : undefined}>
            <span>2</span>Retailer
          </li>
          <li aria-current={selected && recipient ? "step" : undefined}>
            <span>3</span>Sign
          </li>
        </ol>
      )}
      {retailer ? (
        <>
          <h3>Sale & Handover Review</h3>
          <div className="sale-product">
            <img
              className="shoe-image manufacturer-batch-shoe"
              src="/images/manufacturer-batch-shoe.avif"
              alt="White Nike S.T. Dynamite shoe with black swoosh and outsole"
            />
            <div>
              <strong>{selected ? label(selected) : "No pair selected"}</strong>
              <small>{model?.name || "Select a pair from inventory"}</small>
            </div>
          </div>
          <dl className="review-lines">
            <dt>Current Custodian</dt>
            <dd>
              {selected
                ? organization(selected.currentCustodian)?.name ||
                  short(selected.currentCustodian)
                : "—"}
            </dd>
            <dt>Sale Type</dt>
            <dd>Final Sale (Handover)</dd>
            <dt>Handover</dt>
            <dd>Retailer attestation</dd>
            <dt>Customer identity</dt>
            <dd>Not recorded on-chain</dd>
          </dl>
          <div className="custody-notice warning">
            <Info size={25} />
            <div>
              <strong>Irreversible Operation</strong>
              <p>
                This ends custody transfers and cannot be undone. Confirm that
                the selected pair has been handed over to the customer.
              </p>
            </div>
          </div>
          <label className="confirmation-checkbox">
            <input
              type="checkbox"
              disabled={!canSell || app.busy}
              aria-describedby="retailer-sale-help"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I have reviewed these details and confirm this permanent sale and
            handover.
          </label>
          <Button
            className="button full-width"
            disabled={app.busy || !canSell || !confirmed}
            aria-describedby="retailer-sale-help"
            onClick={() => {
              if (selected) void app.transact("markSold", [selected.productId]);
            }}
          >
            <Check size={19} />
            <span>
              {app.busy
                ? "Waiting for wallet…"
                : "Sign & Record Sale (Permanent)"}
            </span>
            <ArrowRight size={18} />
          </Button>
          <p className="form-help" id="retailer-sale-help" role="status">
            {saleHelp}
          </p>
        </>
      ) : (
        <>
          <div className="distributor-transfer-context">
            <Package size={20} aria-hidden="true" />
            <div>
              <strong>
                {selected ? label(selected) : "Choose a pair to transfer"}
              </strong>
              <p>
                {selected
                  ? "Review its passport, then enter the receiving retailer."
                  : "Select a pair from inventory to review its passport and start a transfer."}
              </p>
            </div>
          </div>
          <label htmlFor="recipient">Retailer wallet address</label>
          <Input
            id="recipient"
            list="retailer-wallets"
            disabled={!selected || !authorized || app.busy}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            {...validation.field("recipient")}
            aria-describedby={[
              validation.field("recipient")["aria-describedby"],
              "distributor-transfer-help",
            ]
              .filter(Boolean)
              .join(" ")}
            placeholder="0x… authorized retailer wallet"
          />
          <datalist id="retailer-wallets">
            {organizations
              .filter((o) => o.type === "retailer")
              .map((o) => (
                <option key={o.wallet} value={o.wallet}>
                  {o.name}
                </option>
              ))}
          </datalist>
          {validation.message("recipient")}
          <Button
            className="button full-width"
            disabled={
              app.busy ||
              !authorized ||
              selected?.status !== 3 ||
              !same(selected?.currentCustodian, app.account)
            }
            onClick={transfer}
          >
            Initiate Transfer <ArrowRight size={17} />
          </Button>
          <p className="form-help" id="distributor-transfer-help">
            The selected pair stays in your custody until the retailer confirms
            receipt.
          </p>
        </>
      )}
    </Panel>
  );
  return (
    <>
      <div className={retailer ? "retailer-intro" : "distributor-intro"}>
        <Hero
          eyebrow={retailer ? undefined : "DISTRIBUTOR WORKSPACE"}
          small={retailer}
          title={
            ownOrg?.name ||
            (retailer ? "Retailer Workspace" : "Distributor Workspace")
          }
          description={
            retailer
              ? "Receive inventory, manage pairs, and complete the final sale and handover to customers."
              : "Receive, manage, and transfer authenticated footwear from manufacturers to authorized retailers."
          }
        />
        {retailer && (
          <div className="retailer-scene" aria-hidden="true">
            <img
              className="retailer-scene-background"
              src="/images/retailer-arena-background-v1.webp"
              alt=""
            />
            <img
              className="retailer-scene-shoe"
              src="/images/retailer-arena-shoe-v1.webp"
              alt=""
            />
          </div>
        )}
        {!retailer && (
          <div className="distributor-scene" aria-hidden="true">
            <img
              className="distributor-scene-background"
              src="/images/distributor-treasure-background-v4.png"
              alt=""
            />
            <img
              className="distributor-scene-shoe"
              src="/images/distributor-treasure-shoe-v1.png"
              alt=""
            />
          </div>
        )}
        <Metrics
          items={
            retailer
              ? [
                  {
                    label: "In Inventory",
                    value: loading ? undefined : available.length,
                    Icon: Package,
                  },
                  {
                    label: "Incoming Transfers",
                    value: loading ? undefined : incoming.length,
                    Icon: Truck,
                    note: "Requires Receipt",
                  },
                  {
                    label: "Sales (Handover)",
                    value: loading ? undefined : sold.length,
                    Icon: ShoppingBag,
                  },
                  {
                    label: "Selected Pair Documents",
                    value: detail?.documents.length,
                    Icon: ShieldCheck,
                  },
                ]
              : [
                  {
                    label: "In Your Custody",
                    value: loading ? undefined : available.length,
                    Icon: Package,
                  },
                  {
                    label: "In Transit (Outgoing)",
                    value: loading ? undefined : outgoing.length,
                    Icon: Truck,
                  },
                  {
                    label: "Incoming (Pending Receipt)",
                    value: loading ? undefined : incoming.length,
                    Icon: Package,
                    highlight: true,
                  },
                  {
                    label: "Total in Custody / Pending",
                    value: loading
                      ? undefined
                      : available.length + outgoing.length + incoming.length,
                    Icon: Layers,
                  },
                ]
          }
        />
      </div>
      {registry.error && (
        <p className="notice error" role="alert">
          {registry.error}
        </p>
      )}
      <div className={retailer ? "retailer-grid" : "distributor-grid"}>
        <div>
          {receipts}
          {retailer ? inventory : outgoingPanel}
        </div>
        {retailer ? passport : inventory}
        <div>
          {retailer ? (
            nextAction
          ) : (
            <>
              {passport}
              {nextAction}
            </>
          )}
        </div>
      </div>
      {retailer && (
        <Panel
          title={`Audit Timeline${selected ? ` — ${label(selected)}` : ""}`}
          id="history"
        >
          <div className="audit-strip">
            {detail?.timeline.length ? (
              detail.timeline.map((e, i) => (
                <div key={i}>
                  <span>
                    <Check size={13} />
                  </span>
                  <strong>{e.event.replace(/([a-z])([A-Z])/g, "$1 $2")}</strong>
                  <small>{new Date(e.timestamp * 1000).toLocaleString()}</small>
                </div>
              ))
            ) : (
              <p>Select a pair to view its recorded history.</p>
            )}
          </div>
        </Panel>
      )}
      {location.hash === "#reports" && (
        <Panel title="Workspace Report">
          <p className="pad">
            {available.length} pairs in custody · {incoming.length} incoming
            transfers · {retailer ? sold.length : outgoing.length}{" "}
            {retailer ? "completed handovers" : "outgoing transfers"}.
          </p>
        </Panel>
      )}
      {evidence && (
        <EvidencePanel
          productId={evidence}
          key={`${evidence}-${app.account}`}
        />
      )}
    </>
  );
}
function PlusIcon() {
  return <span aria-hidden="true">＋</span>;
}
