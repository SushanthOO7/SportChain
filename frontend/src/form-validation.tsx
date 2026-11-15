import { useState } from "react";

/** Native fields keep their semantics while validation stays in the application. */
export function useFormValidation() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  function validate(next: Record<string, string>) {
    const invalid = Object.fromEntries(
      Object.entries(next).filter(([, message]) => message),
    );
    setErrors(invalid);
    const first = Object.keys(invalid)[0];
    if (first) document.getElementById(first)?.focus();
    return !first;
  }
  function field(id: string) {
    return {
      "aria-invalid": !!errors[id],
      "aria-describedby": errors[id] ? `${id}-error` : undefined,
      onInput: () =>
        setErrors((current) => {
          if (!current[id]) return current;
          const next = { ...current };
          delete next[id];
          return next;
        }),
    };
  }
  function message(id: string) {
    return errors[id] ? (
      <span className="field-error" id={`${id}-error`} role="alert">
        {errors[id]}
      </span>
    ) : null;
  }
  return { validate, field, message };
}
