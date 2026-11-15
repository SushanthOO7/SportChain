import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  className?: string;
  style?: CSSProperties;
  reverse?: boolean;
  initialOffset?: number;
  borderWidth?: number;
}

/** Magic UI border beam adapted to one SVG stroke on the actual card perimeter.
 * A large moving square can light opposite sides of a short input simultaneously.
 */
export function BorderBeam({
  size = 90,
  duration = 8,
  delay = 0,
  colorFrom = "var(--chart-1)",
  colorTo = "var(--chart-4)",
  className,
  style,
  reverse = false,
  initialOffset = 0,
  borderWidth = 2,
}: BorderBeamProps) {
  const host = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 1, height: 1, radius: 14 });
  const gradientId = `beam-${useId().replace(/:/g, "")}`;
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const radius =
        parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
      setBox({ width: bounds.width, height: bounds.height, radius });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const inset = borderWidth / 2;
  const width = Math.max(0, box.width - borderWidth);
  const height = Math.max(0, box.height - borderWidth);
  const radius = Math.max(
    0,
    Math.min(box.radius - inset, width / 2, height / 2),
  );
  const perimeter = Math.max(
    1,
    2 * (width + height) - (8 - 2 * Math.PI) * radius,
  );
  const length = Math.min(12, (size / perimeter) * 100);
  return (
    <div
      ref={host}
      className={cn("border-beam-orbit", className)}
      style={style}
      aria-hidden="true"
    >
      {width > 0 && height > 0 && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${box.width} ${box.height}`}
          fill="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colorFrom} />
              <stop offset="33%" stopColor="var(--chart-2)" />
              <stop offset="66%" stopColor="var(--chart-3)" />
              <stop offset="100%" stopColor={colorTo} />
            </linearGradient>
          </defs>
          <motion.rect
            data-beam-stroke=""
            x={inset}
            y={inset}
            width={width}
            height={height}
            rx={radius}
            pathLength={100}
            stroke={`url(#${gradientId})`}
            strokeWidth={borderWidth}
            strokeLinecap="round"
            strokeDasharray={`${length} ${100 - length}`}
            initial={{ strokeDashoffset: initialOffset }}
            animate={{
              strokeDashoffset: initialOffset + (reverse ? 100 : -100),
            }}
            transition={{
              duration,
              delay: -delay,
              repeat: Infinity,
              repeatType: "loop",
              ease: "linear",
            }}
          />
        </svg>
      )}
    </div>
  );
}
