import { BorderBeam } from "./ui/border-beam";

/** Decoration only; formOnly lets shared panels opt in when they contain fields. */
export function FormBorderBeam({ formOnly = false }: { formOnly?: boolean }) {
  return (
    <div
      className={`form-border-beam ${formOnly ? "form-only-beam" : ""}`}
      aria-hidden="true"
    >
      <BorderBeam size={90} duration={8} borderWidth={2} />
    </div>
  );
}
