import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCircularProgressBarProps {
  max?: number;
  min?: number;
  value?: number;
  gaugePrimaryColor: string;
  gaugeSecondaryColor: string;
  className?: string;
  /** Inventory extension: retain Magic UI's SVG dash animation with distinct segments. */
  segments?: { value: number; color: string }[];
  children?: ReactNode;
}

export function AnimatedCircularProgressBar({
  max = 100,
  min = 0,
  value = 0,
  gaugePrimaryColor,
  gaugeSecondaryColor,
  className,
  segments,
  children,
}: AnimatedCircularProgressBarProps) {
  const progress = Math.min(
    100,
    Math.max(0, max > min ? ((value - min) / (max - min)) * 100 : 0),
  );
  let offset = 0;
  const arcs = segments || [
    { value: Math.max(0, value - min), color: gaugePrimaryColor },
  ];
  return (
    <div className={cn("circular-progress relative size-40", className)}>
      <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="42"
          stroke={gaugeSecondaryColor}
          strokeWidth="15"
        />
        {arcs.map((arc, index) => {
          const length =
            max > min
              ? Math.min(
                  100 - offset,
                  Math.max(0, (arc.value / (max - min)) * 100),
                )
              : 0;
          const start = offset;
          offset += length;
          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r="42"
              pathLength="100"
              strokeWidth="15"
              stroke={arc.color}
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 50 50)"
              className="inventory-arc"
            />
          );
        })}
      </svg>
      <div className="circular-progress-label">
        {children ?? <span>{Math.round(progress)}%</span>}
      </div>
    </div>
  );
}
