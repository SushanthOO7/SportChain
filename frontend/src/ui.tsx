export function Skeleton({ label = "Loading records…" }: { label?: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
