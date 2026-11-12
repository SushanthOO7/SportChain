import { useState, type FormEvent, type ReactNode } from "react";
import { Search, X, ArrowUpRight, Footprints } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "./context";
import { short, statuses, type Pair } from "./types";

export function Badge({ status }: { status: number }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="dot" />
      {statuses[status] || "Unknown"}
    </span>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Footprints size={30} />
      <p>{children}</p>
    </div>
  );
}
export function SearchBox() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/lookup/${encodeURIComponent(query.trim())}`);
  }
  return (
    <form noValidate className="search" onSubmit={submit}>
      <Search size={18} />
      <label className="sr-only" htmlFor="pair-search">
        Pair identifier or serial code
      </label>
      <input
        id="pair-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter a pair ID or serial code"
        maxLength={200}
      />
      {query && (
        <button
          type="button"
          className="icon-button"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            document.getElementById("pair-search")?.focus();
          }}
        >
          <X size={16} />
        </button>
      )}
      <button className="button small" disabled={!query.trim()}>
        Look up
      </button>
    </form>
  );
}
export function Shoe({ color = "#27766c" }: { color?: string }) {
  return (
    <svg
      className="shoe"
      viewBox="0 0 240 120"
      role="img"
      aria-label="Original illustration of a fictional athletic shoe"
    >
      <ellipse cx="125" cy="100" rx="93" ry="7" fill="#142c31" opacity=".06" />
      <path
        d="M29 73L39 34Q57 56 77 51L100 26L123 33L145 60Q170 72 208 75L218 90Q142 106 29 92Z"
        fill={color}
      />
      <path
        d="M31 82Q109 95 214 82L218 94Q125 111 27 95Z"
        fill="#fff"
        stroke="#cbd8d8"
        strokeWidth="2"
      />
      <path
        d="M90 45L123 50M96 39L116 44M83 52L133 58"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M53 64Q75 82 133 73"
        stroke="#fff"
        strokeWidth="6"
        fill="none"
        opacity=".8"
      />
      <path d="M40 37L32 74" stroke="#102d32" opacity=".25" strokeWidth="5" />
    </svg>
  );
}
export function PairTable({ pairs }: { pairs: Pair[] }) {
  const { models, config } = useApp();
  if (!pairs.length)
    return (
      <Empty>
        No pairs to show yet. Register a pair or seed the local demonstration.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Pair / model</th>
            <th>Status</th>
            <th>Current custodian</th>
            <th>Last activity</th>
            <th>
              <span className="sr-only">Open record</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => {
            const model = models.find((m) => m.id === p.modelId);
            const serial = config?.pairs?.find(
              (item) => item.productId === p.productId,
            )?.serial;
            const custodian = Object.entries(config?.accounts || {}).find(
              ([, address]) =>
                address.toLowerCase() === p.currentCustodian.toLowerCase(),
            )?.[0];
            return (
              <tr key={p.productId}>
                <td>
                  <Link className="pair-link" to={`/lookup/${p.productId}`}>
                    <span className="shoe-thumbnail">
                      <Shoe color={model?.color} />
                    </span>
                    <span>
                      <strong>{model?.name || `Model ${p.modelId}`}</strong>
                      <small className="mono">
                        {serial || short(p.productId)}
                      </small>
                    </span>
                  </Link>
                </td>
                <td>
                  <Badge status={p.status} />
                </td>
                <td>
                  <span className="capitalize">
                    {custodian || "Organization"}
                  </span>
                  <small className="mono">{short(p.currentCustodian)}</small>
                </td>
                <td>{new Date(p.updatedAt * 1000).toLocaleDateString()}</td>
                <td>
                  <Link
                    className="icon-link"
                    aria-label={`View ${serial || p.productId}`}
                    to={`/lookup/${p.productId}`}
                  >
                    <ArrowUpRight size={19} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
export function CustodyTrack({ status }: { status: number }) {
  const current = status === 5 ? 3 : status === 4 ? 2 : status === 3 ? 1 : 0;
  return (
    <ol className="custody-track" aria-label="Recorded custody stages">
      {["Manufacturer", "Distributor", "Retailer", "Sold"].map((name, i) => (
        <li key={name} className={i <= current ? "reached" : ""}>
          <span>{i < current ? "✓" : i + 1}</span>
          {name}
        </li>
      ))}
    </ol>
  );
}
