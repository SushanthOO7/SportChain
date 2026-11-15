import { Manufacturer } from "./workspaces/Manufacturer";
import { Distribution } from "./workspaces/Distribution";
import { Certification } from "./workspaces/Certification";
import { Administration } from "./workspaces/Administration";
export function Dashboard({ role }: { role: string }) {
  return role === "manufacturer" ? (
    <Manufacturer />
  ) : role === "distributor" ? (
    <Distribution />
  ) : role === "retailer" ? (
    <Distribution retailer />
  ) : role === "certifier" ? (
    <Certification />
  ) : (
    <Administration />
  );
}
