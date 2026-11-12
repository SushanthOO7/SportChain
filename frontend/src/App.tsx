import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, Link, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Boxes,
  Factory,
  LayoutDashboard,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { useApp } from "./context";
import { api } from "./api";
import { CustodyTrack, PairTable, SearchBox } from "./components";
import { short, type Pair } from "./types";
const Lookup = lazy(() =>
  import("./Lookup").then((m) => ({ default: m.Lookup })),
);
const Dashboard = lazy(() =>
  import("./Dashboard").then((m) => ({ default: m.Dashboard })),
);

const links = [
  ["/", "Overview", LayoutDashboard],
  ["/manufacturer", "Manufacturer", Factory],
  ["/distributor", "Distributor", Truck],
  ["/retailer", "Retailer", Store],
  ["/certifier", "Certifier", ShieldCheck],
  ["/admin", "Administration", Boxes],
] as const;

export default function App() {
  const { account, config, connect, busy, message, error, refresh } = useApp();
  const location = useLocation();
  useEffect(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Boxes size={23} />
          </span>
          SportChain<span className="brand-period">.</span>
        </Link>
        <p className="sidebar-caption">PROVENANCE WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="network-dot" /> Local blockchain
          <p>Course prototype · Group 24</p>
          <small>All models and demo evidence are simulated.</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span>{" "}
            {links.find(([path]) => path === location.pathname)?.[1] ||
              "Pair record"}
          </span>
          <div className="topbar-actions">
            <span className="network-label">
              <span className="network-dot" /> Local ·{" "}
              {config?.chainId || "offline"}
            </span>
            <button
              className="icon-button"
              onClick={refresh}
              aria-label="Refresh records"
            >
              <RefreshCw size={17} />
            </button>
            <button
              className="button outline"
              onClick={connect}
              disabled={busy || !config}
            >
              <Wallet size={17} />
              {account ? short(account) : "Connect wallet"}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="feedback" aria-live="polite">
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}{" "}
                <button className="text-button" onClick={refresh}>
                  Retry connection
                </button>
              </p>
            )}
          </div>
          <Suspense
            fallback={
              <p className="loading" role="status">
                Loading workspace…
              </p>
            }
          >
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/lookup/:code" element={<Lookup />} />
              {[
                "manufacturer",
                "distributor",
                "retailer",
                "certifier",
                "admin",
              ].map((role) => (
                <Route
                  key={role}
                  path={`/${role}`}
                  element={<Dashboard role={role} />}
                />
              ))}
              <Route
                path="*"
                element={
                  <section className="panel">
                    <h1>Page not found</h1>
                    <Link to="/">Return to overview</Link>
                  </section>
                }
              />
            </Routes>
          </Suspense>
          <footer className="page-footer">
            <span>SportChain · Footwear provenance</span>
            <span>Recorded evidence ≠ guaranteed physical authenticity.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Overview() {
  const { revision, config } = useApp();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    api<{ items: Pair[]; total: number }>(
      `/products?offset=${offset}&limit=25`,
      { signal: abort.signal },
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
  }, [revision, offset]);
  return (
    <>
      <section className="intro">
        <div>
          <p className="eyebrow">TRACE THE JOURNEY</p>
          <h1>Every pair has a history.</h1>
          <p className="intro-copy">
            Follow footwear from its first registration to its final handover.
            <br className="desktop-break" /> One shared record, at every step.
          </p>
        </div>
        <span className="demo-label">
          <Activity size={15} /> Simulated local demo
        </span>
      </section>
      <section className="lookup-banner">
        <div className="lookup-label">
          <ScanLine size={25} />
          <div>
            <strong>Have a pair in hand?</strong>
            <p>Look up its recorded journey. No wallet needed.</p>
          </div>
        </div>
        <SearchBox />
      </section>
      <section className="metrics" aria-label="Inventory snapshot">
        <article>
          <span>Registered pairs</span>
          <strong>{total.toString().padStart(2, "0")}</strong>
          <small>Across the local ledger</small>
        </article>
        <article>
          <span>In transit on this page</span>
          <strong>
            {pairs
              .filter((p) => p.status === 2)
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <small>Awaiting recipient confirmation</small>
        </article>
        <article>
          <span>Sold on this page</span>
          <strong>
            {pairs
              .filter((p) => p.status === 5)
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <small>Retailer-attested handovers</small>
        </article>
        <article className="metric-journey">
          <span>THE CUSTODY PATH</span>
          <CustodyTrack status={5} />
        </article>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SHARED LEDGER</p>
            <h2>Pair inventory</h2>
          </div>
          <span className="muted">{total} recorded pairs</span>
        </div>
        {loading ? (
          <p className="loading" role="status">
            Reading the local ledger…
          </p>
        ) : error ? (
          <p className="notice error" role="alert">
            {error}
          </p>
        ) : (
          <PairTable pairs={pairs} />
        )}
        <div className="panel-footer">
          <span>
            Showing {pairs.length ? offset + 1 : 0}–{offset + pairs.length} of{" "}
            {total}
          </span>
          <div className="button-row">
            <button
              className="button small outline"
              disabled={!offset || loading}
              onClick={() => setOffset((n) => Math.max(0, n - 25))}
            >
              Previous
            </button>
            <button
              className="button small outline"
              disabled={offset + 25 >= total || loading}
              onClick={() => setOffset((n) => n + 25)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <section className="bottom-grid">
        <article className="panel explainer">
          <ShieldCheck size={24} />
          <h2>Evidence you can check.</h2>
          <p>
            Document fingerprints and signed custody events make the recorded
            journey tamper-evident. A matching hash verifies a file’s integrity.
          </p>
          <p className="muted">
            A QR code can be copied. Records do not independently prove a shoe
            is genuine.
          </p>
        </article>
        <article className="panel explainer">
          <Factory size={24} />
          <h2>Move the journey forward.</h2>
          <p>
            Register a pair, acknowledge a shipment, or add supporting evidence
            using an authorized stakeholder wallet.
          </p>
          <Link className="inline-link" to="/manufacturer">
            Open manufacturer workspace <ArrowRight size={17} />
          </Link>
          {config?.pairs?.[0] && (
            <Link
              className="inline-link"
              to={`/lookup/${config.pairs[0].productId}`}
            >
              Explore a sample pair <ArrowRight size={17} />
            </Link>
          )}
        </article>
      </section>
    </>
  );
}
