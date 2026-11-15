import { id } from "ethers";
export const ROLE_NAMES: Record<string, string> = {
  manufacturer: "MANUFACTURER_ROLE",
  distributor: "DISTRIBUTOR_ROLE",
  retailer: "RETAILER_ROLE",
  certifier: "CERTIFIER_ROLE",
  admin: "DEFAULT_ADMIN_ROLE",
};
export type Review = { name: string; args: unknown[]; description: string };
export type Prepared = { hash: string; manifest: string };
export function pairId(code: string) {
  const value = code.trim();
  if (!value) throw new Error("Enter a pair or batch identifier.");
  return /^0x[\da-f]{64}$/i.test(value) ? value : id(value);
}
