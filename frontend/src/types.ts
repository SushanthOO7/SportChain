import type { InterfaceAbi } from "ethers";

export type Config = {
  chainId: number;
  address: string;
  abi: InterfaceAbi;
  deploymentBlockHash: string;
  accounts: Record<string, string>;
  pairs: { serial: string; productId: string; modelId: number }[];
};
export type Model = {
  id: number;
  name: string;
  category: string;
  color: string;
  description: string;
};
export type Pair = {
  productId: string;
  batchId: string;
  modelId: number;
  manufacturer: string;
  currentCustodian: string;
  pendingCustodian: string;
  status: number;
  registeredAt: number;
  updatedAt: number;
};
export type Evidence = {
  hash: string;
  docType: number;
  submittedBy: string;
  submittedAt: number;
};
export type Claim = {
  hash: string;
  passed: boolean;
  certifier: string;
  verifiedAt: number;
  manifest?: { claim: string; evidenceHashes: string[] };
};
export type Detail = Pair & {
  timeline: {
    event: string;
    timestamp: number;
    transactionHash: string;
    block: number;
    args: Record<string, unknown>;
  }[];
  documents: Evidence[];
  claims: Claim[];
};
export type Upload = {
  id: string;
  filename: string;
  hash: string;
  docType: number;
  status: string;
  size: number;
};
export const statuses = [
  "Not registered",
  "Manufactured",
  "In transit",
  "At distributor",
  "At retailer",
  "Sold",
];
export const docTypes = [
  "Product specification",
  "Batch record",
  "Shipping record",
  "Receipt record",
  "Certificate",
  "Other",
];
export const short = (text: string) =>
  text ? `${text.slice(0, 6)}…${text.slice(-4)}` : "—";
export const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
