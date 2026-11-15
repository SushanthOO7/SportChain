import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useApp } from "./context";
import { same, type Pair } from "./types";
export type Organization = {
  roles?: string[];
  name: string;
  wallet: string;
  type: string;
  description: string;
};
export type Batch = {
  batchId: string;
  modelId: number;
  manufacturer: string;
  batchDocHash: string;
  createdAt: number;
  code?: string;
};
export type Activity = {
  event: string;
  productId: string;
  timestamp: number;
  transactionHash: string;
  args: Record<string, unknown>;
};
export type Overview = {
  registered: number;
  transit: number;
  sold: number;
  attested: number;
  documents: number;
  batches: number;
  distribution: { label: string; count: number }[];
  activity: Activity[];
};
type Registry = {
  pairs: Pair[];
  batches: Batch[];
  organizations: Organization[];
  overview?: Overview;
  loading: boolean;
  error: string;
  organization: (address?: string) => Organization | undefined;
  label: (pair: Pair) => string;
};
const RegistryContext = createContext<Registry | null>(null);
export function RegistryProvider({ children }: { children: ReactNode }) {
  const { revision, config } = useApp();
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [overview, setOverview] = useState<Overview>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    Promise.all([
      api<{ items: Pair[]; total: number }>("/products?limit=100", {
        signal: abort.signal,
      }),
      api<Batch[]>("/batches", { signal: abort.signal }),
      api<Organization[]>("/organizations", { signal: abort.signal }),
      api<Overview>("/overview", { signal: abort.signal }),
    ])
      .then(async ([page, b, o, stats]) => {
        const all = [...page.items];
        for (let offset = 100; offset < page.total; offset += 100) {
          const next = await api<{ items: Pair[] }>(
            `/products?limit=100&offset=${offset}`,
            { signal: abort.signal },
          );
          all.push(...next.items);
        }
        if (abort.signal.aborted) return;
        setPairs(all);
        setBatches(b);
        setOrganizations(o);
        setOverview(stats);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [revision]);
  return (
    <RegistryContext.Provider
      value={{
        pairs,
        batches,
        organizations,
        overview,
        loading,
        error,
        organization: (address) =>
          organizations.find((o) => same(o.wallet, address)),
        label: (p) =>
          p.serial ||
          config?.pairs.find((v) => same(v.productId, p.productId))?.serial ||
          `${p.productId.slice(0, 10)}…${p.productId.slice(-4)}`,
      }}
    >
      {children}
    </RegistryContext.Provider>
  );
}
export function useRegistry() {
  const context = useContext(RegistryContext);
  if (!context) throw new Error("Registry context missing");
  return context;
}
