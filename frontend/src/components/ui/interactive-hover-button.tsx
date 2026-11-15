import * as React from "react";
import { cn } from "@/lib/utils";

// Magic UI interactive hover pattern, shared by every application button.
// One accessible label; the animated duplicate is hidden from assistive tools.
export function InteractiveHoverButton({
  children,
  className,
  ...props
}: React.ComponentProps<"button">) {
  const animate = className
    ?.split(/\s+/)
    .some((name) => name === "button" || name === "wallet-button");
  if (!animate)
    return (
      <button className={cn("interactive-hover-button", className)} {...props}>
        {children}
      </button>
    );
  return (
    <button
      className={cn("interactive-hover-button group", className)}
      {...props}
    >
      <span className="hover-button-rest">
        <span className="hover-button-dot" aria-hidden="true" />
        <span className="hover-button-label">{children}</span>
      </span>
      <span className="hover-button-active" aria-hidden="true">
        {children}
      </span>
    </button>
  );
}
