import { useId } from "react";
import { cn } from "@/lib/utils";

type MarkProps = {
  withWordmark?: boolean;
  className?: string;
};

export default function Mark({
  withWordmark = false,
  className = "",
}: MarkProps) {
  const rawId = useId();
  const scope = rawId.replace(/[:]/g, "");
  const strokeGradientId = `${scope}-stroke`;
  const shineGradientId = `${scope}-shine`;
  const fillGradientId = `${scope}-fill`;

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span className="relative inline-flex h-[56px] w-[26px] items-center justify-center">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[-7px] rounded-full opacity-80 blur-[10px]"
          style={{
            background:
              "radial-gradient(circle at 50% 18%, rgba(255,255,255,0.9), transparent 38%), radial-gradient(circle at 50% 74%, rgba(85,81,232,0.18), transparent 72%)",
          }}
        />

        <svg
          width="26"
          height="56"
          viewBox="0 0 26 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-[1]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={strokeGradientId}
              x1="4"
              y1="3"
              x2="22"
              y2="53"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#3F3ACB" />
              <stop offset="0.44" stopColor="#5551E8" />
              <stop offset="1" stopColor="#8A86FF" />
            </linearGradient>

            <linearGradient
              id={shineGradientId}
              x1="8"
              y1="7"
              x2="18"
              y2="48"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="rgba(255,255,255,0.92)" />
              <stop offset="0.52" stopColor="rgba(255,255,255,0.22)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </linearGradient>

            <linearGradient
              id={fillGradientId}
              x1="13"
              y1="6"
              x2="13"
              y2="51"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="rgba(255,255,255,0.72)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
            </linearGradient>
          </defs>

          <rect
            x="4"
            y="3.5"
            width="18"
            height="49"
            rx="9"
            fill={`url(#${fillGradientId})`}
          />

          <rect
            x="4"
            y="3.5"
            width="18"
            height="49"
            rx="9"
            stroke={`url(#${strokeGradientId})`}
            strokeWidth="3.15"
          />

          <rect
            x="8.2"
            y="9.2"
            width="9.6"
            height="28.5"
            rx="4.8"
            fill={`url(#${shineGradientId})`}
            opacity="0.64"
          />

          <circle cx="13" cy="45" r="2.4" fill="rgba(255,255,255,0.72)" />
        </svg>
      </span>

      {withWordmark ? (
        <span className="flex min-w-0 flex-col leading-none">
          <span className="text-[0.98rem] font-semibold tracking-[-0.06em] text-[var(--cs-ink-1)]">
            CloneStore
          </span>
          <span className="mt-1 text-[0.6rem] font-extrabold uppercase tracking-[0.23em] text-[var(--cs-ink-4)]">
            OS d’employés IA
          </span>
        </span>
      ) : null}
    </span>
  );
}