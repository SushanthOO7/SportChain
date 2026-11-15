import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  Package,
  Truck,
  ShieldCheck,
  Send,
  Check,
  Plus,
  Info,
} from "lucide-react";
import { isAddress, ZeroHash } from "ethers";
import { api } from "../api";
import { useApp } from "../context";
import { useRegistry } from "../registry";
import { same, short } from "../types";
import { pairId } from "../workspace-types";
import {
  EmptyState,
  Hash,
  Metrics,
  Modal,
  Panel,
  ShoeImage,
  Status,
} from "../reference-ui";
import { useFormValidation } from "../form-validation";
export function Manufacturer() {
  const app = useApp();
  const { pairs, batches, organizations, organization, label, loading, error } =
    useRegistry();
  const location = useLocation();
  const navigate = useNavigate();
  const authorized = app.roles.includes("MANUFACTURER_ROLE");
  const [modal, setModal] = useState("");
  const [pendingLabel, setPendingLabel] = useState<{
    code: string;
    kind: string;
  }>();
  const [batchCode, setBatchCode] = useState("");
  const [serial, setSerial] = useState("");
  const [model, setModel] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelCategory, setModelCategory] = useState("");
  const [modelSlot, setModelSlot] = useState("1");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [recipient, setRecipient] = useState("");
  const validation = useFormValidation();
  const ownBatches = batches.filter(
    (b) => !app.account || same(b.manufacturer, app.account),
  );
  const batch =
    ownBatches.find((b) => b.batchId === selectedBatch) || ownBatches[0];
  const batchPairs = pairs.filter((p) => p.batchId === batch?.batchId);
  const ownPairs = pairs.filter((p) => same(p.currentCustodian, app.account));
  const eligible = ownPairs.filter((p) => p.status === 1);
  const selectedPairs = eligible.filter((p) => selected.includes(p.productId));
  const outgoing = ownPairs.filter((p) => p.status === 2);
  const selectedModel = app.models.find((m) => m.id === batch?.modelId);
  const activeOrg = organization(app.account);
  useEffect(() => {
    if (app.models.some((m) => String(m.id) === modelSlot)) {
      const next = Array.from({ length: 10 }, (_, i) => i + 1).find(
        (i) => !app.models.some((m) => m.id === i),
      );
      if (next) setModelSlot(String(next));
    }
  }, [app.models, modelSlot]);
  useEffect(() => {
    const section = location.hash.slice(1);
    if (["register-batch", "register-pair", "catalog"].includes(section))
      setModal(section);
    else setModal("");
    if (section === "inventory" || section === "evidence")
      document.getElementById("inventory")?.scrollIntoView();
    if (section === "transfers")
      document.getElementById("transfers")?.scrollIntoView();
  }, [location.hash]);
  function open(section: string) {
    navigate(`/manufacturer#${section}`);
  }
  function close() {
    setModal("");
    navigate("/manufacturer#dashboard");
  }
  async function saveLabel(code: string, kind: string) {
    let saved = false;
    await app.perform(async () => {
      const token = await app.signIn();
      await api(
        "/identifiers",
        { method: "POST", body: JSON.stringify({ code, kind }) },
        token,
      );
      app.refresh();
      saved = true;
    }, "Registration label saved.");
    return saved;
  }
  async function registerBatch(e: FormEvent) {
    e.preventDefault();
    if (pendingLabel?.kind === "batch") {
      if (await saveLabel(pendingLabel.code, pendingLabel.kind)) {
        setPendingLabel(undefined);
        close();
      }
      return;
    }
    if (
      !validation.validate({
        "batch-code": batchCode.trim() ? "" : "Enter a batch code.",
        model: model ? "" : "Choose a catalog model.",
      })
    )
      return;
    if (
      await app.transact("registerBatch", [
        pairId(batchCode),
        Number(model),
        ZeroHash,
      ])
    ) {
      setPendingLabel({ code: batchCode, kind: "batch" });
      if (await saveLabel(batchCode, "batch")) {
        setPendingLabel(undefined);
        close();
      }
    }
  }
  async function registerPair(e: FormEvent) {
    e.preventDefault();
    if (pendingLabel?.kind === "pair") {
      if (await saveLabel(pendingLabel.code, pendingLabel.kind)) {
        setPendingLabel(undefined);
        close();
      }
      return;
    }
    if (
      !validation.validate({
        "pair-batch": batchCode.trim() ? "" : "Enter the batch code or ID.",
        "pair-serial": serial.trim() ? "" : "Enter a unique pair serial.",
      })
    )
      return;
    if (
      await app.transact("registerProduct", [pairId(serial), pairId(batchCode)])
    ) {
      setPendingLabel({ code: serial, kind: "pair" });
      if (await saveLabel(serial, "pair")) {
        setPendingLabel(undefined);
        close();
      }
    }
  }
  async function createModel(e: FormEvent) {
    e.preventDefault();
    if (
      !validation.validate({
        "model-name": modelName.trim() ? "" : "Enter a model name.",
      })
    )
      return;
    await app.perform(async () => {
      const token = await app.signIn();
      await api(
        "/models",
        {
          method: "POST",
          body: JSON.stringify({
            id: Number(modelSlot),
            name: modelName.trim(),
            category: modelCategory,
            color: "#ff5a16",
            description: "",
          }),
        },
        token,
      );
      setModel(modelSlot);
      app.refresh();
      close();
    }, "Catalog model created.");
  }
  async function transfer() {
    if (
      !validation.validate({
        recipient: isAddress(recipient)
          ? ""
          : "Enter an authorized distributor wallet.",
      })
    )
      return;
    for (const p of selectedPairs) {
      if (!(await app.transact("initiateTransfer", [p.productId, recipient])))
        break;
      setSelected((current) => current.filter((id) => id !== p.productId));
    }
  }
  return (
    <>
      <div className="manufacturer-intro">
        <section className="workspace-hero manufacturer-hero">
          <div className="hero-copy">
            <p className="eyebrow">MANUFACTURER WORKSPACE</p>
            <h1>{activeOrg?.name || "Manufacturer Workspace"}</h1>
            <p>
              Register, document, and transfer footwear with verifiable
              blockchain provenance.
            </p>
          </div>
          <div className="manufacturer-scene" aria-hidden="true">
            <img
              className="manufacturer-scene-background"
              src="/images/manufacturer-rainforest-background-v1.png"
              alt=""
              width="2172"
              height="724"
            />
            <span className="manufacturer-shoe-shadow" />
            <img
              className="manufacturer-scene-shoe"
              src="/images/manufacturer-rainforest-shoe-v1.png"
              alt=""
              width="1737"
              height="906"
            />
          </div>
        </section>
        <Metrics
          items={[
            {
              label: "Batches",
              value: loading ? undefined : ownBatches.length,
              Icon: Package,
            },
            {
              label: "Pairs",
              value: loading
                ? undefined
                : pairs.filter(
                    (p) => !app.account || same(p.manufacturer, app.account),
                  ).length,
              Icon: StoreIcon,
            },
            {
              label: "Active Transfers",
              value: loading ? undefined : outgoing.length,
              Icon: Truck,
            },
            {
              label: "Catalog Models",
              value: app.models.length,
              Icon: ShieldCheck,
            },
          ]}
        />
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="manufacturer-grid">
        <div className="manufacturer-records">
          <Panel
            title="Recent Batches"
            aside={
              <Button
                className="button button-compact"
                onClick={() => open("register-batch")}
              >
                Register Batch <Plus size={14} />
              </Button>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Model</th>
                    <th>Registered Pairs</th>
                    <th>Evidence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ownBatches
                    .slice(-5)
                    .reverse()
                    .map((b) => (
                      <tr
                        className={
                          batch?.batchId === b.batchId ? "selected-row" : ""
                        }
                        key={b.batchId}
                      >
                        <td>
                          <Button
                            className="table-record"
                            onClick={() => {
                              setSelectedBatch(b.batchId);
                              setBatchCode(b.code || b.batchId);
                            }}
                          >
                            <ShoeImage />
                            <strong>{b.code || short(b.batchId)}</strong>
                          </Button>
                        </td>
                        <td>
                          {app.models.find((m) => m.id === b.modelId)?.name ||
                            `Model ${b.modelId}`}
                        </td>
                        <td>
                          {pairs.filter((p) => p.batchId === b.batchId).length}
                        </td>
                        <td>
                          {b.batchDocHash !== ZeroHash ? (
                            <Check size={17} className="success-icon" />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <span className="status">Registered</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!ownBatches.length && (
              <EmptyState title="No batches registered">
                Create a catalog model, then register your first production
                batch.
              </EmptyState>
            )}
          </Panel>
          <Panel
            id="inventory"
            title={
              <>
                Pairs in Batch{" "}
                <span className="heading-note">
                  {batch ? `(${batch.code || short(batch.batchId)})` : ""}
                </span>
              </>
            }
            aside={
              <Button
                className="button button-compact"
                onClick={() => open("register-pair")}
              >
                Register Pair <Plus size={14} />
              </Button>
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>
                      <span className="sr-only">Select</span>
                    </th>
                    <th>Pair ID</th>
                    <th>Model</th>
                    <th>Batch</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchPairs.map((p) => (
                    <tr key={p.productId}>
                      <td>
                        <Input
                          type="checkbox"
                          aria-label={`Select ${label(p)}`}
                          disabled={
                            !authorized ||
                            p.status !== 1 ||
                            !same(p.currentCustodian, app.account)
                          }
                          checked={selected.includes(p.productId)}
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, p.productId]
                                : v.filter((id) => id !== p.productId),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Link to={`/lookup/${p.productId}`}>{label(p)}</Link>
                      </td>
                      <td>
                        {app.models.find((m) => m.id === p.modelId)?.name ||
                          `Model ${p.modelId}`}
                      </td>
                      <td>{p.batchCode || short(p.batchId)}</td>
                      <td>
                        <Status status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!batchPairs.length && (
              <EmptyState title="No pairs in this batch">
                Registered pairs and their document hashes will appear here.
              </EmptyState>
            )}
          </Panel>
        </div>
        <div className="manufacturer-operations">
          <Panel
            title={`Batch Details${batch ? ` — ${batch.code || short(batch.batchId)}` : ""}`}
          >
            <div className="batch-details">
              <div className="detail-image">
                <img
                  className="shoe-image manufacturer-batch-shoe"
                  src="/images/manufacturer-batch-shoe.avif"
                  alt="White Nike S.T. Dynamite shoe with black swoosh and outsole"
                />
              </div>
              {batch ? (
                <dl>
                  <dt>Model</dt>
                  <dd>{selectedModel?.name || `Model ${batch.modelId}`}</dd>
                  <dt>Registered</dt>
                  <dd>{batchPairs.length} pairs</dd>
                  <dt>Created</dt>
                  <dd>
                    {new Date(batch.createdAt * 1000).toLocaleDateString()}
                  </dd>
                  <dt>Anchored Hash</dt>
                  <dd>
                    {batch.batchDocHash === ZeroHash ? (
                      "Not attached"
                    ) : (
                      <Hash value={batch.batchDocHash} />
                    )}
                  </dd>
                </dl>
              ) : (
                <div>
                  <strong>Select a registered batch</strong>
                  <p>
                    Its model, registration totals, and evidence will appear
                    here.
                  </p>
                  <Button
                    className="button button-compact"
                    onClick={() => open("catalog")}
                  >
                    Create catalog model <Plus size={14} />
                  </Button>
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Initiate Transfer" id="transfers">
            <div className="transfer-steps">
              <span>
                <Check size={14} />
                Select Pairs
              </span>
              <i />
              <span>
                <Check size={14} />
                Choose Distributor
              </span>
              <i />
              <span className="accent">Review & Initiate</span>
            </div>
            <div className="transfer-grid">
              <div>
                <h3>Transfer Review</h3>
                <dl className="review-lines">
                  <dt>From (Sender)</dt>
                  <dd>{activeOrg?.name || short(app.account)}</dd>
                  <dt>To (Recipient)</dt>
                  <dd>{organization(recipient)?.name || short(recipient)}</dd>
                  <dt>Pairs</dt>
                  <dd>{selectedPairs.length} selected</dd>
                  <dt>Batch</dt>
                  <dd>{batch?.code || short(batch?.batchId || "")}</dd>
                </dl>
                <label htmlFor="recipient">Authorized distributor</label>
                <Input
                  list="distributor-wallets"
                  id="recipient"
                  value={recipient}
                  {...validation.field("recipient")}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Enter wallet address"
                />
                <datalist id="distributor-wallets">
                  {organizations
                    .filter((o) => o.type === "distributor")
                    .map((o) => (
                      <option value={o.wallet} key={o.wallet}>
                        {o.name}
                      </option>
                    ))}
                </datalist>
                {validation.message("recipient")}
              </div>
              <div className="transfer-caution">
                <Info size={22} />
                <strong>Sender Retains Custody Until Receipt</strong>
                <p>
                  Pairs are marked “In Transit” until the named distributor
                  confirms receipt on-chain.
                </p>
                <small>
                  {selectedPairs.length > 1
                    ? `${selectedPairs.length} separate wallet transactions`
                    : "Select pairs from the batch inventory."}
                </small>
                <Button
                  className="button"
                  disabled={app.busy || !authorized || !selectedPairs.length}
                  onClick={transfer}
                >
                  <Send size={17} />
                  Initiate Transfer
                </Button>
              </div>
            </div>
            {!!outgoing.length && (
              <div className="outgoing-inline">
                <h3>Pending outgoing transfers</h3>
                {outgoing.map((p) => (
                  <div key={p.productId}>
                    <Link to={`/lookup/${p.productId}`}>{label(p)}</Link>
                    <Button
                      className="button outline small"
                      disabled={app.busy}
                      onClick={() =>
                        app.transact("cancelTransfer", [p.productId])
                      }
                    >
                      Cancel transfer
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
      {location.hash === "#reports" && (
        <Panel title="Manufacturer Reports">
          <p className="pad">
            {ownBatches.length} registered batches · {ownPairs.length} pairs in
            custody · {outgoing.length} pending transfers. Counts come from
            current ledger records.
          </p>
        </Panel>
      )}
      <Modal
        open={!!modal}
        onClose={close}
        title={
          modal === "catalog"
            ? "Create catalog model"
            : modal === "register-batch"
              ? "Register Batch"
              : "Register Pair"
        }
      >
        {modal === "catalog" ? (
          <form noValidate className="form-stack" onSubmit={createModel}>
            <label htmlFor="model-name">Model name</label>
            <Input
              id="model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              {...validation.field("model-name")}
            />
            {validation.message("model-name")}
            <label htmlFor="model-slot">Catalog slot (1–10)</label>
            <select
              id="model-slot"
              value={modelSlot}
              onChange={(e) => setModelSlot(e.target.value)}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1)
                .filter((i) => !app.models.some((m) => m.id === i))
                .map((i) => (
                  <option key={i}>{i}</option>
                ))}
            </select>
            <label htmlFor="model-category">Category</label>
            <Input
              id="model-category"
              value={modelCategory}
              onChange={(e) => setModelCategory(e.target.value)}
            />
            <Button className="button" disabled={app.busy || !authorized}>
              Create Model
            </Button>
          </form>
        ) : (
          <form
            className="form-stack"
            noValidate
            onSubmit={modal === "register-batch" ? registerBatch : registerPair}
          >
            <label
              htmlFor={modal === "register-batch" ? "batch-code" : "pair-batch"}
            >
              {modal === "register-batch"
                ? "Batch code"
                : "Existing batch code or ID"}
            </label>
            <Input
              id={modal === "register-batch" ? "batch-code" : "pair-batch"}
              disabled={!!pendingLabel}
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              {...validation.field(
                modal === "register-batch" ? "batch-code" : "pair-batch",
              )}
            />
            {validation.message(
              modal === "register-batch" ? "batch-code" : "pair-batch",
            )}
            {modal === "register-batch" ? (
              <>
                <label htmlFor="model">Footwear model</label>
                <select
                  id="model"
                  disabled={!!pendingLabel}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  {...validation.field("model")}
                >
                  <option value="">Select a model</option>
                  {app.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {validation.message("model")}
                <Button
                  type="button"
                  className="button button-compact"
                  onClick={() => open("catalog")}
                >
                  Create a catalog model <Plus size={15} />
                </Button>
              </>
            ) : (
              <>
                <label htmlFor="pair-serial">Unique pair serial</label>
                <Input
                  id="pair-serial"
                  disabled={!!pendingLabel}
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  {...validation.field("pair-serial")}
                />
                {validation.message("pair-serial")}
              </>
            )}
            <Button className="button" disabled={app.busy || !authorized}>
              {pendingLabel
                ? "Retry saving registration label"
                : modal === "register-batch"
                  ? "Register batch"
                  : "Register pair"}
            </Button>
            {!authorized && (
              <p className="form-help">
                Connect a manufacturer wallet to register records.
              </p>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
function StoreIcon() {
  return <Package size={34} strokeWidth={1.5} />;
}
