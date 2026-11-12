import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, Contract, type Eip1193Provider } from "ethers";
import { api } from "./api";
import type { Config, Model } from "./types";

type Ethereum = Eip1193Provider & {
  on?: (event: string, fn: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, fn: (...args: unknown[]) => void) => void;
};
declare global {
  interface Window {
    ethereum?: Ethereum;
  }
}
type Context = {
  config?: Config;
  models: Model[];
  account: string;
  roles: string[];
  token: string;
  busy: boolean;
  message: string;
  error: string;
  revision: number;
  connect: () => Promise<void>;
  signIn: () => Promise<string>;
  refresh: () => void;
  transact: (name: string, args: unknown[]) => Promise<boolean>;
  perform: (work: () => Promise<void>, success?: string) => Promise<void>;
};
const AppContext = createContext<Context | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("App context missing");
  return value;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>();
  const [models, setModels] = useState<Model[]>([]);
  const [account, setAccount] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const tokenExpires = useRef(0);
  const working = useRef(false);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      api<Config>("/config", { signal: abort.signal }),
      api<Model[]>("/models", { signal: abort.signal }),
    ])
      .then(([c, m]) => {
        setConfig(c);
        setModels(m);
        setError("");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [revision]);
  useEffect(() => {
    const reset = () => {
      generation.current++;
      setAccount("");
      setRoles([]);
      setToken("");
      setMessage("Wallet changed. Reconnect to refresh permissions.");
      refresh();
    };
    window.ethereum?.on?.("accountsChanged", reset);
    window.ethereum?.on?.("chainChanged", reset);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", reset);
      window.ethereum?.removeListener?.("chainChanged", reset);
    };
  }, [refresh]);
  useEffect(() => {
    generation.current++;
    setToken("");
    setRoles([]);
  }, [config?.deploymentBlockHash]);
  useEffect(() => {
    const expire = () => {
      setToken("");
      tokenExpires.current = 0;
    };
    window.addEventListener("sportchain:session-expired", expire);
    const timer = token
      ? setTimeout(expire, Math.max(0, tokenExpires.current - Date.now()))
      : undefined;
    return () => {
      window.removeEventListener("sportchain:session-expired", expire);
      clearTimeout(timer);
    };
  }, [token]);

  async function provider() {
    if (!window.ethereum)
      throw new Error(
        "Install MetaMask or another Ethereum wallet to sign transactions. Public lookup works without a wallet.",
      );
    if (!config)
      throw new Error(
        "Deployment configuration is unavailable. Start the local services and seed the chain.",
      );
    // Establish site permission first: MetaMask assigns networks per connected site.
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (Number(chainId) !== config.chainId) {
      setMessage("Approve switching to SportChain Local in your wallet…");
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${config.chainId.toString(16)}` }],
        });
      } catch (error) {
        const code = (error as { code?: number }).code;
        if (code === 4001)
          throw new Error(
            "Network switch declined. Click Connect wallet to try again.",
          );
        if (code === 4902)
          throw new Error(
            "Add SportChain Local in MetaMask using RPC http://127.0.0.1:8545 and chain ID 31337, then reconnect.",
          );
        throw error;
      }
      const selected = await window.ethereum.request({ method: "eth_chainId" });
      if (Number(selected) !== config.chainId)
        throw new Error(
          "Your wallet has not switched to SportChain Local yet. Approve the switch and reconnect.",
        );
    }
    return new BrowserProvider(window.ethereum);
  }
  async function connectInternal() {
    const p = await provider();
    const signer = await p.getSigner();
    const address = await signer.getAddress();
    const contract = new Contract(config!.address, config!.abi, signer);
    const names = [
      "DEFAULT_ADMIN_ROLE",
      "MANUFACTURER_ROLE",
      "DISTRIBUTOR_ROLE",
      "RETAILER_ROLE",
      "CERTIFIER_ROLE",
    ];
    const assigned = await Promise.all(
      names.map(async (name) =>
        (await contract.hasRole(await contract[name](), address)) ? name : "",
      ),
    );
    setAccount(address);
    setRoles(assigned.filter(Boolean));
    setToken("");
    return { signer, address };
  }
  async function perform(work: () => Promise<void>, success?: string) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setMessage("Working…");
    try {
      await work();
      if (success) setMessage(success);
    } catch (e) {
      const err = e as {
        shortMessage?: string;
        message?: string;
        code?: string;
      };
      setMessage("");
      setError(
        err.code === "ACTION_REJECTED"
          ? "Signature declined. Your data is preserved; try again when ready."
          : err.shortMessage ||
              err.message ||
              "The action failed. Please retry.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  async function signIn() {
    if (token && tokenExpires.current > Date.now()) return token;
    const { signer, address } = await connectInternal();
    const epoch = generation.current;
    const challenge = await api<{ id: string; message: string }>(
      "/auth/challenge",
      { method: "POST", body: JSON.stringify({ address }) },
    );
    const signature = await signer.signMessage(challenge.message);
    const result = await api<{ token: string; expiresAt: number }>(
      "/auth/verify",
      {
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.id, signature }),
      },
    );
    if (epoch !== generation.current)
      throw new Error(
        "Wallet or deployment changed during sign-in. Reconnect and try again.",
      );
    tokenExpires.current = result.expiresAt * 1000;
    setToken(result.token);
    return result.token;
  }
  async function transact(name: string, args: unknown[]) {
    let passed = false;
    await perform(async () => {
      const p = await provider();
      const signer = await p.getSigner();
      if (
        !account ||
        (await signer.getAddress()).toLowerCase() !== account.toLowerCase()
      )
        throw new Error("Connect the active wallet before submitting.");
      const contract = new Contract(config!.address, config!.abi, signer);
      setMessage("Confirm this transaction in your wallet…");
      const tx = await contract[name](...args);
      setMessage(`Waiting for confirmation · ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      passed = true;
      refresh();
    }, "Transaction confirmed. The recorded history has been updated.");
    return passed;
  }
  return (
    <AppContext.Provider
      value={{
        config,
        models,
        account,
        roles,
        token,
        busy,
        message,
        error,
        revision,
        refresh,
        perform,
        signIn,
        connect: () =>
          perform(async () => {
            await connectInternal();
          }, "Wallet connected."),
        transact,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
