import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "./components/ui/dialog";
import { FormBorderBeam } from "./components/FormBorderBeam";
import { FootwearScene } from "./components/FootwearScene";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ComponentType,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Copy,
  Factory,
  Truck,
  Store,
  UserRound,
  ShieldCheck,
  Search,
  X,
  Package,
  FileText,
  FlaskConical,
  Info,
  ChevronRight,
} from "lucide-react";
import { useRegistry } from "./registry";
import { useApp } from "./context";
import { same, short, statuses, type Pair } from "./types";
export const roleIcons = {
  manufacturer: Factory,
  distributor: Package,
  retailer: Store,
  certifier: FlaskConical,
  admin: ShieldCheck,
};
export function Logo() {
  return (
    <Link to="/" className="brand" aria-label="SportChain overview">
      <img
        className="brand-mark"
        src="/images/sportchain-logo.png"
        width="56"
        height="32"
        alt=""
        aria-hidden="true"
      />
      <span>
        <strong className="sportchain-wordmark">SPORTCHAIN</strong>
      </span>
    </Link>
  );
}
export function ShoeImage({
  passport = false,
  className = "",
  decorative = false,
}: {
  passport?: boolean;
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      className={`shoe-image ${className}`}
      src={`/images/${passport ? "passport-shoe" : "reference-shoe"}.webp`}
      width="1689"
      height="931"
      alt={decorative ? "" : "Illustrative footwear visualization"}
      aria-hidden={decorative || undefined}
    />
  );
}
export function Ribbon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`ribbon ${className}`}
      viewBox="0 0 900 300"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ribbon-fill" x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#ff7d31" stopOpacity="0" />
          <stop offset=".4" stopColor="#ff5b13" stopOpacity=".7" />
          <stop offset=".75" stopColor="#ff7b30" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffd8be" stopOpacity=".25" />
        </linearGradient>
      </defs>
      <path
        d="M0 230C170 285 200 10 390 80S560 220 720 80 860 10 940 55L940 125C800 40 780 230 620 220S470 85 340 140 130 320 0 270Z"
        fill="url(#ribbon-fill)"
      />
      <path
        d="M0 260C160 300 230 100 390 160S550 280 720 140 860 60 940 90L940 155C790 100 750 300 600 270S430 165 330 210 120 340 0 300Z"
        fill="#ffb78b"
        opacity=".22"
      />
    </svg>
  );
}
export function Panel({
  title,
  aside,
  children,
  id,
  className = "",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <Card id={id} className={`panel ${className}`}>
      {title && (
        <CardHeader className="panel-heading">
          <CardTitle>
            <h2>{title}</h2>
          </CardTitle>
          {aside}
        </CardHeader>
      )}
      <CardContent className="panel-content">{children}</CardContent>
      <FormBorderBeam formOnly />
    </Card>
  );
}
export function EmptyState({
  title = "No records yet",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Package size={27} strokeWidth={1.3} />
      <strong>{title}</strong>
      <p>{children || "Records will appear here after they are registered."}</p>
    </div>
  );
}
export function Status({ status }: { status: number }) {
  return (
    <span className={`status status-${status}`}>
      <span />
      {statuses[status] || "Unknown"}
    </span>
  );
}
export function Metrics({
  items,
}: {
  items: {
    label: string;
    value: number | string | undefined;
    Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
    note?: string;
    highlight?: boolean;
  }[];
}) {
  return (
    <section className="metrics">
      {items.map(({ label, value, Icon, note, highlight }) => (
        <article key={label} className={highlight ? "metric-highlight" : ""}>
          <Icon size={40} strokeWidth={1.5} />
          <div>
            <span>{label}</span>
            <strong>
              {typeof value === "number"
                ? value.toLocaleString()
                : (value ?? "—")}
            </strong>
            {note && <small>{note}</small>}
          </div>
        </article>
      ))}
    </section>
  );
}
export function LookupSearch() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className="lookup-search"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim())
          navigate(`/lookup/${encodeURIComponent(query.trim())}`);
      }}
    >
      <Search size={21} />
      <label htmlFor="serial-search" className="sr-only">
        Pair identifier or serial code
      </label>
      <Input
        id="serial-search"
        placeholder="Enter Pair Serial / Scan QR"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={200}
      />
      {query && (
        <Button
          type="button"
          className="icon-button"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            document.getElementById("serial-search")?.focus();
          }}
        >
          <X size={15} />
        </Button>
      )}
      <Button className="button" disabled={!query.trim()}>
        Lookup Pair <ArrowRight data-icon="inline-end" />
      </Button>
      <FormBorderBeam />
    </form>
  );
}
export function CopyButton({
  value,
  label = "Copy identifier",
}: {
  value: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timeout.current), []);
  return (
    <span className="copy-control">
      <Button
        className="icon-button"
        type="button"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setStatus("Copied");
          } catch {
            setStatus("Copy unavailable");
          }
          clearTimeout(timeout.current);
          timeout.current = setTimeout(() => setStatus(""), 2500);
        }}
      >
        {status === "Copied" ? <Check size={14} /> : <Copy size={14} />}
      </Button>
      <span className="sr-only" role="status">
        {status}
      </span>
    </span>
  );
}
export function Hash({ value, label }: { value: string; label?: string }) {
  return (
    <span className="hash">
      <code title={value}>{short(value)}</code>
      <CopyButton value={value} label={label} />
    </span>
  );
}
export function CustodyFlow({
  pair,
  compact = false,
}: {
  pair?: Pair;
  compact?: boolean;
}) {
  const { organization } = useRegistry();
  const stages = [
    {
      name: pair
        ? organization(pair.manufacturer)?.name || "Manufacturer"
        : "Manufacturer",
      Icon: Factory,
      done: !!pair,
    },
    { name: "In Transit", Icon: Truck, done: pair?.status === 2 },
    {
      name:
        pair && pair.status === 3
          ? organization(pair.currentCustodian)?.name || "Distributor"
          : "Distributor",
      Icon: Package,
      done:
        !!pair &&
        (pair.status >= 3 ||
          (pair.status === 2 &&
            !same(pair.currentCustodian, pair.manufacturer))),
    },
    {
      name:
        pair && pair.status === 4
          ? organization(pair.currentCustodian)?.name || "Retailer"
          : "Retailer",
      Icon: Store,
      done: !!pair && pair.status >= 4,
    },
    { name: "Customer", Icon: UserRound, done: pair?.status === 5 },
  ];
  return (
    <div className={`custody-flow ${compact ? "compact" : ""}`}>
      {stages.map(({ name, Icon, done }, i) => (
        <div className="custody-stage-wrap" key={i}>
          <div className={`custody-stage ${done ? "stage-active" : ""}`}>
            <Icon size={28} strokeWidth={1.6} />
            <strong>{name}</strong>
            <small>
              {i === 1
                ? "Awaiting receipt"
                : i === 4
                  ? "Final handover"
                  : i === 0
                    ? "Manufacturer"
                    : i === 2
                      ? "Distributor"
                      : "Retailer"}
            </small>
          </div>
          {i < 4 && <ChevronRight size={16} />}
        </div>
      ))}
    </div>
  );
}
export function CustodyNotice() {
  return (
    <div className="custody-notice">
      <Info size={23} />
      <div>
        <strong>In Transit ≠ Custody Change</strong>
        <p>
          The sender retains custody until the named recipient confirms receipt
          on-chain.
        </p>
      </div>
    </div>
  );
}
export function Hero({
  eyebrow,
  title,
  description,
  children,
  small = false,
  scene,
}: {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
  small?: boolean;
  scene?: ReactNode;
}) {
  return (
    <section className={`workspace-hero ${small ? "small-hero" : ""}`}>
      <div className="hero-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </div>
      <div className="hero-visual" aria-hidden="true">
        {scene ?? <FootwearScene />}
      </div>
    </section>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const app = useApp();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="form-dialog" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {app.error && (
          <p className="notice error" role="alert">
            {app.error}
          </p>
        )}
        {app.busy && app.message && (
          <p className="notice" role="status">
            {app.message}
          </p>
        )}
        {children}
        <FormBorderBeam />
      </DialogContent>
    </Dialog>
  );
}

export function ActivityList() {
  const { overview, organization } = useRegistry();
  const icons: Record<string, typeof Truck> = {
    TransferInitiated: Truck,
    ReceiptConfirmed: Check,
    ProductRegistered: Package,
    DocumentAnchored: FileText,
    ClaimVerified: FlaskConical,
    ProductSold: Store,
  };
  return overview?.activity.length ? (
    <ul className="activity-list">
      {overview.activity.slice(0, 4).map((event, i) => {
        const Icon = icons[event.event] || Package;
        return (
          <li key={`${event.transactionHash}-${i}`}>
            <span className="activity-icon">
              <Icon size={20} />
            </span>
            <div>
              <strong>{event.event.replace(/([a-z])([A-Z])/g, "$1 $2")}</strong>
              <small>
                {event.args.from
                  ? `${organization(String(event.args.from))?.name || short(String(event.args.from))} → ${organization(String(event.args.to))?.name || short(String(event.args.to))}`
                  : short(event.productId)}
              </small>
            </div>
            <time>
              {new Date(event.timestamp * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </li>
        );
      })}
    </ul>
  ) : (
    <EmptyState title="No activity yet">
      Registration, transfers and attestations will appear here.
    </EmptyState>
  );
}
