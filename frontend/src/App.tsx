import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  Bell,
  Factory,
  FlaskConical,
  Home,
  ShieldCheck,
  Store,
  Truck,
  Wallet,
  Menu,
  X,
  ScanLine,
  RefreshCw,
} from "lucide-react";
import { useApp } from "./context";
import { RegistryProvider, useRegistry } from "./registry";
import { Logo, ActivityList } from "./reference-ui";
import { short } from "./types";
import { Skeleton } from "./ui";
const Overview = lazy(() => import("./ReferenceOverview"));
const Dashboard = lazy(() =>
  import("./Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Lookup = lazy(() =>
  import("./Lookup").then((m) => ({ default: m.Lookup })),
);
const globalLinks = [
  ["/", "Overview", Home],
  ["/lookup", "Pair Passport", ScanLine],
  ["/manufacturer", "Manufacturer", Factory],
  ["/distributor", "Distributor", Truck],
  ["/retailer", "Retailer", Store],
  ["/certifier", "Certifier", FlaskConical],
  ["/admin", "Administration", ShieldCheck],
] as const;
export default function App() {
  return (
    <RegistryProvider>
      <Shell />
    </RegistryProvider>
  );
}
function Shell() {
  const { account, config, busy, connect, message, error, refresh } = useApp();
  const { overview } = useRegistry();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const navDialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const restore = useRef(true);
  useEffect(() => {
    restore.current = false;
    setDrawer(false);
    setNotifications(false);
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (drawer) navDialog.current?.showModal();
    else navDialog.current?.close();
  }, [drawer]);
  useEffect(() => {
    const m = matchMedia("(min-width:1201px)");
    const close = () => {
      if (m.matches) setDrawer(false);
    };
    m.addEventListener("change", close);
    return () => m.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    if (message && busy) toast.loading(message, { id: "app-success" });
    else if (message) toast.success(message, { id: "app-success" });
    else toast.dismiss("app-success");
  }, [message, busy]);
  useEffect(() => {
    if (error)
      toast.error(error, {
        id: "app-error",
        duration: 8000,
        action: { label: "Retry", onClick: refresh },
      });
    else toast.dismiss("app-error");
  }, [error, refresh]);
  const nav = (
    <>
      <Logo />
      <nav aria-label="Main navigation">
        {globalLinks.map(([to, label, I]) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setDrawer(false)}
          >
            <I size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
  return (
    <div className="app-shell">
      <Toaster position="top-right" richColors closeButton theme="light" />
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <dialog
        ref={navDialog}
        className="navigation-dialog"
        aria-label="Workspace navigation"
        onCancel={() => setDrawer(false)}
        onClose={() => {
          setDrawer(false);
          if (restore.current) opener.current?.focus();
          else document.getElementById("main")?.focus({ preventScroll: true });
        }}
      >
        <Button
          className="icon-button close-navigation"
          aria-label="Close navigation"
          onClick={() => setDrawer(false)}
        >
          <X />
        </Button>
        {drawer && nav}
      </dialog>
      <div
        className={`workspace workspace-${location.pathname.split("/")[1] || "overview"}`}
      >
        <header className="topbar">
          <Button
            className="icon-button menu-toggle"
            ref={opener}
            aria-label="Open navigation"
            aria-expanded={drawer}
            onClick={() => {
              restore.current = true;
              setDrawer(true);
            }}
          >
            <Menu />
          </Button>
          <Logo />
          <nav className="top-tabs" aria-label="Workspaces">
            {globalLinks.map(([to, label]) => (
              <NavLink end={to === "/"} key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-actions">
            <Button
              className="icon-button"
              aria-label="Refresh records"
              onClick={refresh}
            >
              <RefreshCw size={17} />
            </Button>
            <Button
              className="icon-button notification-button"
              aria-expanded={notifications}
              aria-label="Recent activity"
              onClick={() => setNotifications((v) => !v)}
            >
              <Bell size={23} />
              {!!overview?.activity.length && <span />}
            </Button>
            <Button
              className={`wallet-button ${account ? "connected" : ""}`}
              aria-label={
                account ? `Wallet connected: ${account}` : "Connect wallet"
              }
              title={account ? `Connected: ${account}` : "Connect wallet"}
              onClick={connect}
              disabled={busy || !config}
            >
              <Wallet size={17} />
              <i className="wallet-status-dot" aria-hidden="true" />
              <span>{account ? short(account) : "Connect wallet"}</span>
            </Button>
          </div>
          {notifications && (
            <div className="notifications">
              <h2>Recent activity</h2>
              <ActivityList />
            </div>
          )}
        </header>
        <main id="main" tabIndex={-1}>
          <Suspense fallback={<Skeleton label="Loading workspace…" />}>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/lookup/:code" element={<Lookup />} />
              {[
                "manufacturer",
                "distributor",
                "retailer",
                "certifier",
                "admin",
              ].map((role) => (
                <Route
                  path={`/${role}`}
                  key={role}
                  element={<Dashboard key={role} role={role} />}
                />
              ))}
              <Route
                path="*"
                element={
                  <section className="panel pad">
                    <h1>Page not found</h1>
                    <Link to="/">Return to overview</Link>
                  </section>
                }
              />
            </Routes>
          </Suspense>
        </main>
        <footer className="page-footer">
          <span>
            <i className="network-dot" />
            Local blockchain · {config?.chainId || "Offline"}
          </span>
          <span>SportChain · Footwear Provenance</span>
        </footer>
      </div>
    </div>
  );
}
