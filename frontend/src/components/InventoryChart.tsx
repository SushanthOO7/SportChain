import { useEffect, useRef, useState } from "react";
import { AnimatedCircularProgressBar } from "./ui/animated-circular-progress-bar";

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
const empty = [
  "At manufacturer",
  "At distributor",
  "At retailer",
  "In transit",
  "Sold",
].map((label) => ({ label, count: 0 }));

export function InventoryChart({
  total,
  distribution = empty,
  ready,
  loading = false,
}: {
  total: number;
  distribution?: { label: string; count: number }[];
  ready: boolean;
  loading?: boolean;
}) {
  const [entry, setEntry] = useState(0);
  const [settled, setSettled] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    let frame = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      cancelAnimationFrame(frame);
      setEntry(1);
      setSettled(true);
      started.current = true;
    };
    if (reduce.matches) {
      finish();
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1200);
      setEntry(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    const changed = () => {
      if (reduce.matches) finish();
    };
    reduce.addEventListener("change", changed);
    return () => {
      cancelAnimationFrame(frame);
      reduce.removeEventListener("change", changed);
    };
  }, [ready]);
  const shown = ready ? total : 0;
  return (
    <div
      className="inventory-distribution"
      data-entry-state={settled ? "settled" : ready ? "entering" : "waiting"}
      aria-busy={loading}
    >
      <div
        role="img"
        aria-label={
          ready
            ? `${total.toLocaleString()} total pairs. ${distribution.map((i) => `${i.label}: ${i.count}`).join(", ")}`
            : "Inventory unavailable or loading"
        }
      >
        <AnimatedCircularProgressBar
          className="inventory-ring"
          value={shown}
          max={Math.max(total, 1)}
          gaugePrimaryColor={palette[0]}
          gaugeSecondaryColor="var(--chart-track)"
          segments={distribution.map((item, index) => ({
            value: ready ? item.count * entry : 0,
            color: palette[index % palette.length],
          }))}
        >
          <strong>
            {ready ? Math.round(shown * entry).toLocaleString() : "—"}
          </strong>
          <span>Total Pairs</span>
        </AnimatedCircularProgressBar>
      </div>
      <ul>
        {distribution.map((item, index) => (
          <li key={item.label}>
            <i style={{ background: palette[index % palette.length] }} />
            <span>{item.label.replace(/^At /, "")}</span>
            <strong>
              {ready ? Math.round(item.count * entry).toLocaleString() : "—"}
            </strong>
            <small>
              {ready
                ? `(${(total ? (item.count / total) * 100 : 0).toFixed(1)}%)`
                : ""}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}
