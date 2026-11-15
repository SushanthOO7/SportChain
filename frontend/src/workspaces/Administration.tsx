import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { id, ZeroHash, isAddress } from "ethers";
import { Plus, Package, ShieldCheck, ArrowRight } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import { useRegistry } from "../registry";
import { ROLE_NAMES } from "../workspace-types";
import {
  EmptyState,
  Hash,
  Hero,
  Modal,
  Panel,
  roleIcons,
  ActivityList,
} from "../reference-ui";
import { useFormValidation } from "../form-validation";
export function Administration() {
  const app = useApp();
  const location = useLocation();
  const { organizations } = useRegistry();
  const [add, setAdd] = useState(false);
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [type, setType] = useState("manufacturer");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("RETAILER_ROLE");
  const [tab, setTab] = useState("Grant Role");
  const [review, setReview] = useState<{
    action: string;
    target: string;
    role: string;
  } | null>(null);
  const validation = useFormValidation();
  const authorized = app.roles.includes("DEFAULT_ADMIN_ROLE");
  const roleLabel =
    Object.entries(ROLE_NAMES).find(([, r]) => r === role)?.[0] || "retailer";
  const Icon = roleIcons[roleLabel as keyof typeof roleIcons] || ShieldCheck;
  async function create(e: FormEvent) {
    e.preventDefault();
    if (
      !validation.validate({
        "organization-name": name.trim() ? "" : "Enter an organization name.",
        "organization-wallet": isAddress(wallet)
          ? ""
          : "Enter a valid wallet address.",
      })
    )
      return;
    await app.perform(async () => {
      const token = await app.signIn();
      await api(
        "/organizations",
        {
          method: "POST",
          body: JSON.stringify({ name, wallet, type, description }),
        },
        token,
      );
      app.refresh();
      setAdd(false);
    }, "Organization profile created. Grant its role to authorize blockchain actions.");
  }
  return (
    <>
      <div className="admin-intro">
        <Hero
          small
          scene={
            <div className="admin-studio-scene">
              <img
                src="/images/admin-studio-background-v2.png"
                alt=""
                width="1536"
                height="1024"
              />
              <img
                className="admin-studio-shoes"
                src="/images/admin-studio-shoes-v1.png"
                alt=""
                width="1536"
                height="1024"
              />
            </div>
          }
          eyebrow="ADMINISTRATION"
          title="Platform & Organization Management"
          description="Manage organizations, wallets, and role access across the SportChain network."
        />
        <Button
          className="button"
          onClick={() => setAdd(true)}
          disabled={!authorized}
        >
          <Plus size={17} />
          Add Organization
        </Button>
      </div>
      <div className="admin-grid">
        <Panel
          title={
            <>
              Organization Directory{" "}
              <span className="count-bubble">{organizations.length}</span>
            </>
          }
          id="organizations"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Type</th>
                  <th>Wallet Address</th>
                  <th>Profile</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const OrgIcon =
                    roleIcons[org.type as keyof typeof roleIcons] || Package;
                  return (
                    <tr key={org.wallet}>
                      <td>
                        <div className="organization-table-name">
                          <OrgIcon size={25} />
                          <div>
                            <strong>{org.name}</strong>
                            <small>{org.description || org.type}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="type-tag">{org.type}</span>
                      </td>
                      <td>
                        <Hash value={org.wallet} />
                      </td>
                      <td>
                        <span
                          className={`status ${org.roles?.includes(ROLE_NAMES[org.type]) ? "status-4" : ""}`}
                        >
                          {org.roles?.includes(ROLE_NAMES[org.type])
                            ? "Active"
                            : "No Role Granted"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!organizations.length && (
            <EmptyState title="No organizations added">
              Add your organization profiles, then grant roles to their wallets.
            </EmptyState>
          )}
        </Panel>
        <Panel title="Role Management" id="permissions">
          <div
            className="detail-tabs admin-role-tabs"
            role="tablist"
            aria-label="Role management"
          >
            {["Grant Role", "Revoke Role", "Role Assignments"].map((t) => (
              <button
                type="button"
                id={`admin-tab-${t.replaceAll(" ", "-")}`}
                aria-controls="admin-role-content"
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  validation.validate({ "permission-address": "" });
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div
            id="admin-role-content"
            role="tabpanel"
            aria-labelledby={`admin-tab-${tab.replaceAll(" ", "-")}`}
          >
            {tab === "Role Assignments" ? (
              <div className="pad">
                {organizations.length ? (
                  organizations.map((org) => (
                    <div className="history-row" key={org.wallet}>
                      <strong>{org.name}</strong>
                      <span>
                        {org.roles?.length
                          ? org.roles
                              .map((role) =>
                                role.replace(/_ROLE$/, "").replaceAll("_", " "),
                              )
                              .join(", ")
                          : "No roles granted"}
                      </span>
                      <Hash value={org.wallet} />
                    </div>
                  ))
                ) : (
                  <EmptyState title="No organization profiles" />
                )}
                <p className="form-help">
                  Role permissions are enforced by the blockchain. Profiles do
                  not grant permissions.
                </p>
              </div>
            ) : (
              <form
                className="role-management-form"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (
                    validation.validate({
                      "permission-address": isAddress(target)
                        ? ""
                        : "Enter a valid organization wallet.",
                    })
                  )
                    setReview({
                      action: tab === "Grant Role" ? "grantRole" : "revokeRole",
                      target,
                      role,
                    });
                }}
              >
                <div>
                  <label htmlFor="permission-address">
                    Organization wallet
                  </label>
                  <Input
                    id="permission-address"
                    list="organization-wallets"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    {...validation.field("permission-address")}
                    placeholder="0x… or select an organization"
                  />
                  <datalist id="organization-wallets">
                    {organizations.map((org) => (
                      <option key={org.wallet} value={org.wallet}>
                        {org.name}
                      </option>
                    ))}
                  </datalist>
                  {validation.message("permission-address")}
                  <label htmlFor="permission-role">
                    {tab === "Revoke Role" ? "Role to revoke" : "Role to grant"}
                  </label>
                  <select
                    id="permission-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {Object.entries(ROLE_NAMES).map(([key, value]) => (
                      <option key={key} value={value}>
                        {key === "admin"
                          ? "Administrator"
                          : key.charAt(0).toUpperCase() + key.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="role-preview">
                  <Icon size={28} />
                  <div>
                    <h3>
                      {roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}{" "}
                      Role
                    </h3>
                    <p>
                      {roleLabel === "retailer"
                        ? "Confirm incoming transfers, manage custody, and record final sale and handover."
                        : roleLabel === "manufacturer"
                          ? "Create production batches, register unique pairs, attach evidence, and transfer to distributors."
                          : roleLabel === "distributor"
                            ? "Confirm receipt, manage inventory, and transfer pairs to authorized retailers."
                            : roleLabel === "certifier"
                              ? "Anchor evidence and record attributable claim attestations."
                              : "Grant and revoke access across the platform."}
                    </p>
                    <small>
                      Wallet signatures required for on-chain changes.
                    </small>
                  </div>
                </div>
                <div className="admin-role-actions">
                  {!authorized && (
                    <p className="form-help">
                      Connect an administrator wallet to manage role access.
                    </p>
                  )}
                  <Button className="button" disabled={app.busy || !authorized}>
                    {tab} <ArrowRight size={17} />
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Panel>
      </div>
      {location.hash === "#history" && (
        <Panel title="Audit Logs">
          <ActivityList />
        </Panel>
      )}
      <Modal open={add} title="Add Organization" onClose={() => setAdd(false)}>
        <form className="form-stack" noValidate onSubmit={create}>
          <label htmlFor="organization-name">Organization name</label>
          <Input
            id="organization-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...validation.field("organization-name")}
          />
          {validation.message("organization-name")}
          <label htmlFor="organization-wallet">Wallet address</label>
          <Input
            id="organization-wallet"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            {...validation.field("organization-wallet")}
          />
          {validation.message("organization-wallet")}
          <label htmlFor="organization-type">Organization type</label>
          <select
            id="organization-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {["manufacturer", "distributor", "retailer", "certifier"].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
          <label htmlFor="organization-description">Description</label>
          <Input
            id="organization-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button className="button" disabled={app.busy || !authorized}>
            Add Organization
          </Button>
        </form>
      </Modal>
      <Modal
        open={!!review}
        title="Review before signing"
        onClose={() => setReview(null)}
      >
        {review && (
          <>
            <p>
              {review.action === "grantRole" ? "Grant" : "Revoke"}{" "}
              <strong>{review.role}</strong> for{" "}
              <code className="break">{review.target}</code>?
            </p>
            <p>
              This changes the wallet's on-chain permissions. Historical custody
              and evidence remain recorded.
            </p>
            {review.role === "DEFAULT_ADMIN_ROLE" && (
              <p className="notice warning">
                Administrator access controls all role permissions. Avoid
                removing the last administrator.
              </p>
            )}
            <Button
              className="button"
              disabled={app.busy || !authorized}
              onClick={async () => {
                if (
                  await app.transact(review.action, [
                    review.role === "DEFAULT_ADMIN_ROLE"
                      ? ZeroHash
                      : id(review.role),
                    review.target,
                  ])
                )
                  setReview(null);
              }}
            >
              Confirm and sign <ArrowRight size={16} />
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}
