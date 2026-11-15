import { Button } from "@/components/ui/button";
import { InventoryChart } from "./components/InventoryChart";
import { FootwearScene } from "./components/FootwearScene";
import { Link } from "react-router-dom";
import {
  Package,
  Truck,
  ShoppingBag,
  ShieldCheck,
  Factory,
  Store,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import { useRegistry } from "./registry";
import { useApp } from "./context";
import { ActivityList, LookupSearch, Metrics, Panel } from "./reference-ui";
export default function Overview() {
  const { overview, organizations, loading, error } = useRegistry();
  const { refresh } = useApp();
  const roleCards = [
    ["manufacturer", "Manufacturer", Factory],
    ["distributor", "Distributor", Package],
    ["retailer", "Retailer", Store],
    ["certifier", "Certifier", FlaskConical],
  ] as const;
  const total = overview?.registered || 0;
  return (
    <>
      <section className="overview-hero">
        <div className="overview-art" aria-hidden="true">
          <FootwearScene />
        </div>

        <div className="overview-feature">
          <div className="overview-copy">
            <p className="eyebrow">ATHLETIC FOOTWEAR PROVENANCE</p>
            <h1>
              <span>Trace Every Pair</span>{" "}
              <span className="editorial-line">Across the Supply Chain</span>
            </h1>
            <p>
              Register, transfer, verify, and certify footwear from
              <br className="desktop-break" /> manufacturing to the final
              customer — across multiple organizations.
            </p>
            <LookupSearch />
          </div>
        </div>
        <div className="organization-rail">
          {roleCards.map(([role, title, Icon]) => {
            const org = organizations.find((o) => o.type === role);
            return (
              <Link key={role} to={`/${role}`}>
                <span>
                  <Icon size={30} strokeWidth={1.6} />
                </span>
                <div>
                  <strong>{org?.name || title}</strong>
                  <small>{org ? title : "Open workspace"}</small>
                </div>
                <ArrowRight size={19} />
              </Link>
            );
          })}
        </div>
      </section>
      {error && (
        <div className="notice error" role="alert">
          {error}
          <Button className="text-button" onClick={refresh}>
            Retry inventory
          </Button>
        </div>
      )}
      <Metrics
        items={[
          {
            label: "Registered Pairs",
            value: loading || error ? undefined : overview?.registered,
            Icon: Package,
          },
          {
            label: "In Transit",
            value: loading || error ? undefined : overview?.transit,
            Icon: Truck,
          },
          {
            label: "Sold (Handover Completed)",
            value: loading || error ? undefined : overview?.sold,
            Icon: ShoppingBag,
          },
          {
            label: "Pairs with Attestations",
            value: loading || error ? undefined : overview?.attested,
            Icon: ShieldCheck,
          },
        ]}
      />
      <div className="overview-grid">
        <Panel title="Pair Inventory">
          <InventoryChart
            loading={loading}
            total={total}
            distribution={overview?.distribution}
            ready={!loading && !error && !!overview}
          />
        </Panel>
        <Panel title="Recent Activity" className="activity-panel">
          <ActivityList />
        </Panel>
      </div>
    </>
  );
}
